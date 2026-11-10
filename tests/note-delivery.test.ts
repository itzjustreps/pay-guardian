import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/send-notes/route';
import { POST as AI_POST } from '../app/api/ai-query/route';
import { checkNote } from '../lib/ai-checkNote';
import type { NoteReply } from '../extension/utils/note-message';
import { readSellerNote } from '../extension/utils/seller-note';
import { redactSellerNote } from '../extension/utils/redact-note';
import { validateAnalysisPayload } from '../extension/utils/analysis-payload';
import { handleNoteMessage } from '../extension/utils/handle-note-message';

vi.mock('../lib/ai-checkNote', () => ({ checkNote: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(checkNote).mockReset();
});

describe('seller-note delivery', () => {
  it('extracts and redacts a synthetic note, calls both real routes, and returns the assessment through the background handler', async () => {
    // Real route handlers run in-process. Only model generation and HTTP transport are mocked.
    const assessment = {
      status: 'analysed' as const,
      summary: 'The note presses for immediate contact.',
      findings: [
        {
          category: 'urgency' as const,
          evidence: 'URGENT call [PHONE_1]',
          explanation: 'Presses for an immediate call.',
        },
      ],
    };
    vi.mocked(checkNote).mockResolvedValue(assessment);
    vi.stubEnv('APP_BASE_URL', 'http://localhost:3001');
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      const request = new Request(url, options);
      if (new URL(url).pathname === '/api/send-notes') return POST(request);
      if (new URL(url).pathname === '/api/ai-query') return AI_POST(request);
      throw new Error('Unexpected test destination');
    });
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

    const reply = await new Promise<NoteReply>((resolve) => {
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

    expect(reply).toEqual({ ok: true, assessment });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/send-notes');
    expect(JSON.parse(options.body as string)).toEqual({
      version: 1,
      sellerNote: 'PayPal Support: URGENT call [PHONE_1] or email [EMAIL_1]!',
    });
    expect(options.body).not.toContain('07700900123');
    expect(options.body).not.toContain('john@example.com');
    expect(options.body).not.toContain('synthetic');
    const [aiUrl, aiOptions] = fetchMock.mock.calls[1]!;
    expect(aiUrl).toBe('http://localhost:3001/api/ai-query');
    expect(aiOptions.body).toBe(options.body);
    expect(checkNote).toHaveBeenCalledExactlyOnceWith(
      validation.data.sellerNote,
    );
  });
});
