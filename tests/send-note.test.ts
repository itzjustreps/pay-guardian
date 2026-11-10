import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendNote } from '../extension/utils/send-note';
import type { AnalysisPayload } from '../extension/utils/analysis-payload';

const payload: AnalysisPayload = {
  version: 1,
  sellerNote: 'URGENT call [PHONE_1]',
};
const assessment = {
  status: 'analysed',
  summary: 'No strong urgency signal detected.',
  findings: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendNote', () => {
  it('posts the complete validated payload and returns the validated assessment', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'received', analysis: assessment }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendNote(payload)).resolves.toEqual(assessment);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:3000/api/send-notes',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: expect.any(AbortSignal),
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it('rejects invalid runtime input before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendNote({ version: 1, sellerNote: ' ' })).rejects.toThrow(
      'Invalid analysis payload',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 429, 500])(
    'rejects HTTP %s instead of reporting success',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(new Response('Private server error', { status })),
      );
      await expect(sendNote(payload)).rejects.toThrow(
        `Analysis request failed (HTTP ${status})`,
      );
    },
  );

  it('rejects an unexpected JSON response, even when HTTP succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ status: 'safe' }))),
    );
    await expect(sendNote(payload)).rejects.toThrow(
      'Invalid analysis response from API',
    );
  });

  it('rejects a receipt acknowledgement that contains no assessment', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: 'received' })),
        ),
    );
    await expect(sendNote(payload)).rejects.toThrow(
      'Invalid analysis response from API',
    );
  });

  it('propagates network failures to the caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    await expect(sendNote(payload)).rejects.toThrow('Failed to fetch');
  });

  it('rejects non-JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Not our API</html>')),
    );
    await expect(sendNote(payload)).rejects.toThrow();
  });

  it('sets a 28-second timeout and propagates cancellation', async () => {
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(controller.signal);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener(
              'abort',
              () => reject(new Error('Timed out')),
              { once: true },
            );
          }),
      ),
    );

    const request = sendNote(payload);
    const assertion = expect(request).rejects.toThrow('Timed out');
    controller.abort();
    await assertion;
    expect(timeout).toHaveBeenCalledWith(28_000);
  });
});
