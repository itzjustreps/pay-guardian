import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchSellerNote } from '../extension/utils/seller-note';

vi.mock('../extension/utils/seller-note', () => ({ watchSellerNote: vi.fn() }));
const sendMessage = vi.fn();

beforeEach(() => {
  vi.resetModules();
  sendMessage.mockReset();
  vi.stubGlobal('browser', { runtime: { sendMessage } });
  vi.stubGlobal('defineContentScript', (options: unknown) => options);
  vi.stubGlobal(
    'createShadowRootUi',
    async (
      _ctx: unknown,
      options: {
        onMount: (container: HTMLElement) => void;
      },
    ) => ({ mount: () => options.onMount(document.body) }),
  );
  vi.mocked(watchSellerNote).mockReset().mockReturnValue(vi.fn());
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

async function mount() {
  const { default: script } = await import('../extension/entrypoints/content');
  const ctx = { isInvalid: false, onInvalidated: vi.fn() };
  // WXT supplies these globals and context in the browser.
  await (script as unknown as { main: (ctx: unknown) => Promise<void> }).main(
    ctx,
  );
  return document.querySelector<HTMLButtonElement>(
    'button:not(.close-button)',
  )!;
}
function ready(text = 'Payment due in 14 days.') {
  vi.mocked(watchSellerNote).mock.calls[0]![0]({ status: 'ready', text });
}

it('waits for a note and sends only after a click, including a one-character note', async () => {
  const button = await mount();
  expect(button).toBeDisabled();
  button.click();
  expect(sendMessage).not.toHaveBeenCalled();
  ready('A');
  expect(button).toBeEnabled();
  expect(sendMessage).not.toHaveBeenCalled();
  sendMessage.mockResolvedValue({ ok: false });
  button.click();
  expect(sendMessage).toHaveBeenCalledWith({
    type: 'SEND_NOTE',
    payload: { version: 1, sellerNote: 'A' },
  });
  await vi.waitFor(() => expect(button).toBeEnabled());
});

it('stops before sending an invalid payload', async () => {
  const button = await mount();
  ready('a'.repeat(10_001));
  button.click();
  expect(sendMessage).not.toHaveBeenCalled();
});

it.each(['empty', 'missing', 'ambiguous'] as const)(
  'keeps the button disabled for %s notes',
  async (status) => {
    const button = await mount();
    vi.mocked(watchSellerNote).mock.calls[0]![0]({ status });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Unavailable');
  },
);

it.each(['success', 'invalid reply', 'rejection'] as const)(
  'prevents overlapping requests and restores the button after %s',
  async (outcome) => {
    let resolve!: (value: unknown) => void;
    let reject!: (reason: Error) => void;
    sendMessage.mockReturnValue(
      new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      }),
    );
    const button = await mount();
    ready();
    button.click();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Checking…');
    button.dispatchEvent(new MouseEvent('click'));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    if (outcome === 'rejection') reject(new Error('Unavailable'));
    else
      resolve(
        outcome === 'success'
          ? {
              ok: true,
              assessment: {
                status: 'analysed',
                summary: 'No urgency detected.',
                findings: [],
              },
            }
          : {},
      );
    await vi.waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveTextContent('Check invoice');
    expect(button).not.toHaveAttribute('aria-busy');
  },
);

it('shows the validated summary, evidence and explanation as text', async () => {
  const button = await mount();
  const evidence =
    '<img src=x onerror=alert(1)> Call now or your account will close.';
  ready(evidence);
  sendMessage.mockResolvedValue({
    ok: true,
    assessment: {
      status: 'analysed',
      summary: 'The note pressures immediate action.',
      findings: [
        {
          category: 'urgency',
          evidence,
          explanation: 'Account closure is used as a threat.',
        },
      ],
    },
  });
  button.click();
  await vi.waitFor(() =>
    expect(document.body).toHaveTextContent('Warning signs found'),
  );
  expect(document.body).toHaveTextContent(
    'The note pressures immediate action.',
  );
  expect(document.querySelector('blockquote')).toHaveTextContent(evidence);
  expect(document.body).toHaveTextContent(
    'Account closure is used as a threat.',
  );
  expect(document.querySelector('img')).toBeNull();
  expect(document.body).toHaveTextContent('does not prove fraud');
});

it.each(['analysed', 'insufficient_context'] as const)(
  'explains an empty %s assessment without declaring safety',
  async (status) => {
    const button = await mount();
    ready();
    sendMessage.mockResolvedValue({
      ok: true,
      assessment: { status, summary: 'Assessment summary.', findings: [] },
    });
    button.click();
    await vi.waitFor(() =>
      expect(document.body).toHaveTextContent(
        status === 'analysed'
          ? 'No urgency warning signs found'
          : 'Not enough context',
      ),
    );
    expect(document.querySelector('blockquote')).toBeNull();
  },
);

it('replaces old findings during a retry and displays errors on screen', async () => {
  const button = await mount();
  ready();
  sendMessage.mockResolvedValueOnce({
    ok: true,
    assessment: {
      status: 'analysed',
      summary: 'Previous summary.',
      findings: [],
    },
  });
  button.click();
  await vi.waitFor(() =>
    expect(document.body).toHaveTextContent('Previous summary.'),
  );
  sendMessage.mockRejectedValueOnce(new Error('Private error details'));
  button.click();
  expect(document.body).not.toHaveTextContent('Previous summary.');
  await vi.waitFor(() =>
    expect(document.body).toHaveTextContent(
      'Could not complete the check. Please try again.',
    ),
  );
  expect(document.body).not.toHaveTextContent('Private error details');
});

it('dismisses the panel without starting a check', async () => {
  await mount();
  document
    .querySelector<HTMLButtonElement>('[aria-label="Close assessment panel"]')!
    .click();
  expect(document.querySelector('.panel')).toBeNull();
  expect(sendMessage).not.toHaveBeenCalled();
});
