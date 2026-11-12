// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CASES,
  accountFingerprint,
  createInvoices,
  readConfig,
  recipientUrl,
  type State,
} from '../scripts/paypal-sandbox.mjs';

const config = readConfig({
  PAYPAL_SANDBOX_CLIENT_ID: 'synthetic-client',
  PAYPAL_SANDBOX_CLIENT_SECRET: 'synthetic-secret',
  PAYPAL_SANDBOX_MERCHANT_EMAIL: 'merchant@example.com',
  PAYPAL_SANDBOX_RECIPIENT_EMAIL: 'customer@example.com',
});
const id = 'INV2-AAAA-BBBB-CCCC-DDDD';
const url = 'https://www.sandbox.paypal.com/invoice/p/TEST';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const details = (status = 'UNPAID') =>
  json({ status, detail: { metadata: { recipient_view_url: url } } });
const fresh = (): State => ({
  version: 1,
  account: accountFingerprint(config),
  entries: {},
});

it('creates one sandbox invoice, saves its ID before sending, and suppresses email notifications', async () => {
  const saved: State[] = [];
  const save = async (state: State) => {
    saved.push(structuredClone(state));
  };
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ access_token: 'test-token' }))
    .mockResolvedValueOnce(json({ id }, 201))
    .mockResolvedValueOnce(details('DRAFT'))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(details());
  const state = fresh();
  await createInvoices(config, CASES.slice(0, 1), state, save, request);
  expect(saved[0].entries.urgency).toMatchObject({ creating: true });
  expect(saved[1].entries.urgency).toMatchObject({ id, creating: false });
  expect(state.entries.urgency.url).toBe(url);
  for (const [target, options] of request.mock.calls) {
    expect(String(target).startsWith('https://api-m.sandbox.paypal.com/')).toBe(
      true,
    );
    expect(options?.redirect).toBe('error');
  }
  const body = JSON.parse(request.mock.calls[1][1]!.body as string);
  expect(body.detail.note).toBe(CASES[0].note);
  expect(body.detail.invoice_date).toBeUndefined();
  expect(body.items[0].unit_amount).toEqual({
    currency_code: 'GBP',
    value: '1.00',
  });
  expect(JSON.parse(request.mock.calls[3][1]!.body as string)).toEqual({
    send_to_recipient: false,
    send_to_invoicer: false,
  });
  expect(JSON.stringify(state)).not.toContain('synthetic-secret');
  expect(JSON.stringify(state)).not.toContain('test-token');
});

it('resumes a sent invoice without creating or sending another', async () => {
  const state = fresh();
  state.entries.urgency = { number: 'PG-test', id, creating: false };
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ access_token: 'token' }))
    .mockResolvedValueOnce(details());
  await createInvoices(
    config,
    CASES.slice(0, 1),
    state,
    async () => {},
    request,
  );
  expect(request).toHaveBeenCalledTimes(2);
  expect(state.entries.urgency.url).toBe(url);
});

it('retains an uncertain create attempt and refuses an automatic retry', async () => {
  const state = fresh();
  const save = vi.fn(async () => {});
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ access_token: 'token' }))
    .mockRejectedValueOnce(new Error('private provider details'));
  await expect(
    createInvoices(config, CASES.slice(0, 1), state, save, request),
  ).rejects.toThrow('No automatic retry');
  expect(state.entries.urgency.creating).toBe(true);
  const retry = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ access_token: 'token' }));
  await expect(
    createInvoices(config, CASES.slice(0, 1), state, save, retry),
  ).rejects.toThrow('Creation outcome');
  expect(retry).toHaveBeenCalledTimes(1);
});

it('accepts the documented create link response without following an external link', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ access_token: 'token' }))
    .mockResolvedValueOnce(
      json(
        {
          href: `https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${id}`,
        },
        201,
      ),
    )
    .mockResolvedValueOnce(details());
  const state = fresh();
  await createInvoices(
    config,
    CASES.slice(0, 1),
    state,
    async () => {},
    request,
  );
  expect(state.entries.urgency.id).toBe(id);
});

it('refuses to reuse state with different sandbox accounts before any request', async () => {
  const request = vi.fn<typeof fetch>();
  await expect(
    createInvoices(
      config,
      CASES,
      { ...fresh(), account: 'different' },
      async () => {},
      request,
    ),
  ).rejects.toThrow('different sandbox settings');
  expect(request).not.toHaveBeenCalled();
});

it('does not expose API error response bodies', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(json({ private: 'sensitive-response' }, 401));
  await expect(
    createInvoices(config, CASES.slice(0, 1), fresh(), async () => {}, request),
  ).rejects.toThrow('HTTP 401');
});

it.each([
  'https://www.paypal.com/invoice/p/TEST',
  'https://attacker.example/invoice/p/TEST',
  'https://www.sandbox.paypal.com/invoice/details/TEST',
])('rejects unsupported recipient link %s', (link) => {
  expect(() => recipientUrl(link)).toThrow();
});

describe('configuration', () => {
  it('requires all four sandbox fields without echoing provided credentials', () => {
    expect(() =>
      readConfig({ PAYPAL_SANDBOX_CLIENT_SECRET: 'do-not-log' }),
    ).toThrow('Set valid sandbox settings');
  });
});
