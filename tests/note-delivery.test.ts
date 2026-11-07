import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/send-notes/route';
import { readSellerNote } from '../extension/utils/seller-note';
import { redactSellerNote } from '../extension/utils/redact-note';
import { validateAnalysisPayload } from '../extension/utils/analysis-payload';
import { handleNoteMessage } from '../extension/utils/handle-note-message';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('seller-note delivery', () => {
  it('extracts and redacts a synthetic note, delivers it through the background handler, and accepts the actual API acknowledgement', async () => {
    // This uses the real route handler in-process, not a live HTTP server or Chrome.
    const fetchMock = vi.fn(async (url: string, options: RequestInit) =>
      POST(new Request(url, options)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const root = document.createElement('div');
    root.innerHTML =
      '<div class="notes-container"><p class="label">Note from seller</p><p>PayPal Support: URGENT call 07700900123 or email john@example.com!</p></div>';
    const note = readSellerNote(root);
    if (note.status !== 'ready') throw new Error('Synthetic note not found');

    const validation = validateAnalysisPayload({
      version: 1,
      sellerNote: redactSellerNote(note.text),
    });
    if (!validation.success) throw new Error('Synthetic payload invalid');

    const reply = await new Promise<{ ok: boolean }>((resolve) => {
      const keepChannelOpen = handleNoteMessage(
        { type: 'SEND_NOTE', payload: validation.data },
        {
          id: 'test-extension',
          url: 'https://www.sandbox.paypal.com/invoice/p/#synthetic',
          tab: { id: 1 },
          frameId: 0,
        },
        'test-extension',
        resolve,
      );
      expect(keepChannelOpen).toBe(true);
    });

    expect(reply).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/send-notes');
    expect(JSON.parse(options.body as string)).toEqual({
      version: 1,
      sellerNote: 'PayPal Support: URGENT call [PHONE_1] or email [EMAIL_1]!',
    });
    expect(options.body).not.toContain('07700900123');
    expect(options.body).not.toContain('john@example.com');
    expect(options.body).not.toContain('synthetic');
  });
});
