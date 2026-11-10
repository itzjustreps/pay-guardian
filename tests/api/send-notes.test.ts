import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/send-notes/route';
import { MAX_SELLER_NOTE_LENGTH } from '../../extension/utils/analysis-payload';

const assessment = {
  status: 'analysed',
  summary: 'No strong urgency signal detected.',
  findings: [],
};
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify(assessment)));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3001');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function postPayload(payload: unknown) {
  return POST(
    new Request('http://localhost:3000/api/send-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
}

describe('POST /api/send-notes', () => {
  it.each([
    'Thank you for your order.',
    'PayPal Support: URGENT call [PHONE_1] to cancel this charge!',
  ])(
    'forwards the validated note and returns the AI assessment %#',
    async (sellerNote) => {
      const response = await postPayload({ version: 1, sellerNote });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'application/json',
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({
        status: 'received',
        analysis: assessment,
      });
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        'http://localhost:3001/api/ai-query',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 1, sellerNote }),
          signal: expect.any(AbortSignal),
          credentials: 'omit',
          redirect: 'error',
          cache: 'no-store',
        }),
      );
    },
  );

  it.each(['', '{invalid', '{"version":1,'])(
    'rejects an empty or malformed JSON body %#',
    async (body) => {
      const response = await POST(
        new Request('http://localhost:3000/api/send-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid JSON' });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    [],
    'a bare note string',
    {},
    { version: 1 },
    { sellerNote: 'Note' },
    { version: '1', sellerNote: 'Note' },
    { version: 2, sellerNote: 'Note' },
    { version: 1, sellerNote: 123 },
    { version: 1, sellerNote: null },
    { version: 1, sellerNote: '' },
    { version: 1, sellerNote: ' \n\t ' },
    { version: 1, sellerNote: 'Note', rawNote: 'Private data' },
  ])(
    'rejects invalid payload %# with a generic error, without echoing input',
    async (payload) => {
      const response = await postPayload(payload);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Invalid analysis payload',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('accepts a note at the length limit', async () => {
    const response = await postPayload({
      version: 1,
      sellerNote: 'a'.repeat(MAX_SELLER_NOTE_LENGTH),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'received',
      analysis: assessment,
    });
  });

  it('rejects an oversized note instead of truncating and acknowledging it', async () => {
    const response = await postPayload({
      version: 1,
      sellerNote: 'a'.repeat(MAX_SELLER_NOTE_LENGTH + 1),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid analysis payload',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the configured destination rather than a caller-controlled request host', async () => {
    const response = await POST(
      new Request('https://attacker.example/api/send-notes', {
        method: 'POST',
        body: JSON.stringify({ version: 1, sellerNote: '  Note  ' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/ai-query',
      expect.objectContaining({
        body: JSON.stringify({ version: 1, sellerNote: 'Note' }),
      }),
    );
  });

  it('requires an explicit backend origin in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_BASE_URL', '');
    const response = await postPayload({ version: 1, sellerNote: 'Note' });
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([429, 500, 503])(
    'handles upstream HTTP %s without reporting success or echoing errors',
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response('Private provider details', { status }),
      );
      const response = await postPayload({ version: 1, sellerNote: 'Note' });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: 'AI analysis unavailable',
      });
    },
  );

  it.each([
    new Response('<html>Not JSON</html>'),
    new Response(JSON.stringify({ status: 'received' })),
    new Response(JSON.stringify({ ...assessment, status: 'safe' })),
  ])('rejects a malformed upstream response %#', async (upstream) => {
    fetchMock.mockResolvedValue(upstream);
    const response = await postPayload({ version: 1, sellerNote: 'Note' });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Invalid AI analysis response',
    });
  });

  it('handles network errors and timeouts as unavailable analysis', async () => {
    fetchMock.mockRejectedValue(new Error('Network unavailable'));
    const response = await postPayload({ version: 1, sellerNote: 'Note' });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'AI analysis unavailable' });
  });
});
