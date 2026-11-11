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
  return document.querySelector('button')!;
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
