import { randomUUID, createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  unlink,
} from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const BASE = 'https://api-m.sandbox.paypal.com';
export const CASES = [
  {
    id: 'urgency',
    note: 'Call 07700900123 immediately or your account will be suspended.',
    expected: ['urgency'],
  },
  {
    id: 'sensitive',
    note: 'Please reply with your PayPal password and one-time login code to verify this invoice.',
    expected: ['sensitive_information_request'],
  },
  {
    id: 'both',
    note: 'Send your login code immediately or your account will be closed.',
    expected: ['urgency', 'sensitive_information_request'],
  },
  {
    id: 'contact',
    note: 'For questions about this invoice, email help@example.com.',
    expected: [],
    advice: true,
  },
  {
    id: 'legitimate',
    note: 'Never share your password or login codes. Payment is due in 14 days.',
    expected: [],
  },
];
const configSchema = z.object({
  PAYPAL_SANDBOX_CLIENT_ID: z.string().trim().min(1),
  PAYPAL_SANDBOX_CLIENT_SECRET: z.string().trim().min(1),
  PAYPAL_SANDBOX_MERCHANT_EMAIL: z.email(),
  PAYPAL_SANDBOX_RECIPIENT_EMAIL: z.email(),
});
const invoiceIdSchema = z.string().regex(/^INV2-[A-Z0-9-]+$/);
const entrySchema = z.object({
  number: z.string(),
  // Persist before creating: a lost response must never cause an automatic duplicate.
  creating: z.boolean().default(false),
  id: invoiceIdSchema.optional(),
  url: z.string().optional(),
});
const stateSchema = z.object({
  version: z.literal(1),
  account: z.string(),
  entries: z.record(z.string(), entrySchema),
});
export type State = z.infer<typeof stateSchema>;
type Config = z.infer<typeof configSchema>;

export function readConfig(env: Record<string, string | undefined>): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Set valid sandbox settings in .env.paypal-sandbox: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return parsed.data;
}
export function accountFingerprint(config: Config) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        config.PAYPAL_SANDBOX_CLIENT_ID,
        config.PAYPAL_SANDBOX_MERCHANT_EMAIL,
        config.PAYPAL_SANDBOX_RECIPIENT_EMAIL,
      ]),
    )
    .digest('hex');
}
export function recipientUrl(value: unknown): string {
  const url = new URL(z.string().parse(value));
  if (
    url.origin !== 'https://www.sandbox.paypal.com' ||
    !url.pathname.startsWith('/invoice/p/') ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'PayPal returned a recipient URL outside the extension’s supported sandbox invoice pages. Inspect the invoice in the sandbox dashboard.',
    );
  }
  return url.href;
}

export async function createInvoices(
  config: Config,
  cases: typeof CASES,
  state: State,
  save: (state: State) => Promise<void>,
  request: typeof fetch = fetch,
) {
  if (state.account !== accountFingerprint(config))
    throw new Error(
      'Saved invoices belong to different sandbox settings. Use the original settings or a separate state file.',
    );
  let token = '';
  async function call(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      response = await request(`${BASE}${path}`, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(
        `PayPal sandbox request failed at ${path}; saved progress was retained. No automatic retry was made.`,
      );
    }
    if (!response.ok)
      throw new Error(
        `PayPal sandbox returned HTTP ${response.status} at ${path}. Check sandbox credentials, account setup and saved progress. Response bodies are not logged.`,
      );
    if (response.status === 204) return undefined;
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new Error(
        `Invalid JSON from PayPal sandbox at ${path}. Saved progress was retained.`,
      );
    }
  }
  const tokenBody = await call('/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.PAYPAL_SANDBOX_CLIENT_ID}:${config.PAYPAL_SANDBOX_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  token = z
    .object({ access_token: z.string().min(1) })
    .parse(tokenBody).access_token;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  for (const test of cases) {
    const entry = state.entries[test.id] ?? {
      number: `PG-${randomUUID().slice(0, 8)}-${CASES.findIndex((item) => item.id === test.id) + 1}`,
      creating: false,
    };
    state.entries[test.id] = entry;
    if (!entry.id) {
      if (entry.creating)
        throw new Error(
          `Creation outcome for ${test.id} (${entry.number}) is uncertain. Find that invoice number in the sandbox dashboard and put its INV2 ID into the saved entry before rerunning. Do not delete the entry unless you have verified no invoice was created.`,
        );
      entry.creating = true;
      await save(state);
      const result = await call('/v2/invoicing/invoices', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          detail: {
            invoice_number: entry.number,
            currency_code: 'GBP',
            note: test.note,
            payment_term: { term_type: 'DUE_ON_RECEIPT' },
          },
          invoicer: { email_address: config.PAYPAL_SANDBOX_MERCHANT_EMAIL },
          primary_recipients: [
            {
              billing_info: {
                email_address: config.PAYPAL_SANDBOX_RECIPIENT_EMAIL,
              },
            },
          ],
          items: [
            {
              name: `Pay Guardian sandbox test: ${test.id}`,
              quantity: '1',
              unit_amount: { currency_code: 'GBP', value: '1.00' },
            },
          ],
        }),
      });
      const created = z
        .object({ id: invoiceIdSchema.optional(), href: z.string().optional() })
        .parse(result);
      const fromLink = created.href?.match(
        /\/v2\/invoicing\/invoices\/(INV2-[A-Z0-9-]+)$/,
      )?.[1];
      entry.id = invoiceIdSchema.parse(created.id ?? fromLink);
      entry.creating = false;
      await save(state);
    }
    const path = `/v2/invoicing/invoices/${entry.id}`;
    const detailsSchema = z.object({
      status: z.string(),
      detail: z
        .object({
          metadata: z
            .object({ recipient_view_url: z.string().optional() })
            .optional(),
        })
        .optional(),
    });
    let details = detailsSchema.parse(await call(path, { headers }));
    if (details.status === 'DRAFT') {
      await call(`${path}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          send_to_recipient: false,
          send_to_invoicer: false,
        }),
      });
      details = detailsSchema.parse(await call(path, { headers }));
    }
    if (
      !['SENT', 'UNPAID', 'PARTIALLY_PAID', 'PAYMENT_PENDING'].includes(
        details.status,
      )
    ) {
      throw new Error(
        `Invoice ${entry.id} has status ${details.status}; inspect it in the sandbox dashboard before sharing.`,
      );
    }
    entry.url = recipientUrl(details.detail?.metadata?.recipient_view_url);
    await save(state);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--all', '--dry-run'].includes(arg)))
    throw new Error('Usage: npm run sandbox:invoices -- [--dry-run] [--all]');
  const cases = args.includes('--all') ? CASES : CASES.slice(0, 1);
  if (args.includes('--dry-run')) {
    console.log(
      JSON.stringify({ sandbox: BASE, notifications: false, cases }, null, 2),
    );
    return;
  }
  const config = readConfig(process.env);
  const file = resolve('artifacts/paypal-sandbox/invoices.json');
  await mkdir(dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const handle = await open(lock, 'wx').catch(() => {
    throw new Error(
      'Another run may be active. If a previous process crashed, confirm it has stopped before removing artifacts/paypal-sandbox/invoices.json.lock.',
    );
  });
  try {
    let state: State;
    try {
      state = stateSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error(
          'Saved invoice state is invalid; inspect it before proceeding.',
        );
      state = { version: 1, account: accountFingerprint(config), entries: {} };
    }
    const save = async (next: State) => {
      await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2), {
        mode: 0o600,
      });
      await rename(`${file}.tmp`, file);
    };
    await createInvoices(config, cases, state, save);
    const report = [
      '# Pay Guardian sandbox test invoices',
      '',
      'Expected outcomes only; these invoices have not been evaluated by the AI or verified in Chrome.',
      'No email notifications requested. Use synthetic details only.',
      '',
    ];
    for (const test of CASES) {
      const entry = state.entries[test.id];
      if (!entry?.url) continue;
      report.push(
        `## ${test.id}`,
        '',
        `- Invoice: ${entry.id}`,
        `- Link: ${recipientUrl(entry.url)}`,
        `- Expected findings: ${test.expected.join(', ') || 'none'}`,
        `- Contact advice expected: ${'advice' in test && test.advice ? 'yes' : 'no'}`,
        '',
        `Note: ${test.note}`,
        '',
      );
    }
    await writeFile(
      resolve('artifacts/paypal-sandbox/TEST-INVOICES.md'),
      report.join('\n'),
    );
    console.log(
      'Saved invoice IDs and links in artifacts/paypal-sandbox/. Open the first recipient link in Chrome and verify the extension before running --all.',
    );
  } finally {
    await handle.close();
    await unlink(lock);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    // Zod errors can contain received values. Never print raw API bodies/errors.
    console.error(
      error instanceof z.ZodError
        ? 'PayPal returned unexpected data. Inspect saved progress before retrying.'
        : error instanceof Error
          ? error.message
          : 'Sandbox setup failed.',
    );
    process.exitCode = 1;
  });
}
