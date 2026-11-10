import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APICallError } from 'ai';
import { POST } from '../../app/api/ai-query/route';
import { checkNote } from '../../lib/ai-checkNote';
import type { AiResponse } from '../../lib/ai-response';

vi.mock('../../lib/ai-checkNote', () => ({ checkNote: vi.fn() }));

const assessment: AiResponse = {
  status: 'analysed',
  summary: 'The note pressures the recipient to act immediately.',
  findings: [
    {
      category: 'urgency',
      evidence: 'Call now or your account closes.',
      explanation:
        'Uses a threatened consequence to pressure an immediate action.',
    },
  ],
};

function request(body: string) {
  return new Request('http://localhost:3001/api/ai-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

beforeEach(() => {
  vi.mocked(checkNote).mockReset();
  vi.mocked(checkNote).mockResolvedValue(assessment);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/ai-query', () => {
  it('validates the payload, passes only the trimmed note, and returns the assessment', async () => {
    const response = await POST(
      request(
        JSON.stringify({
          version: 1,
          sellerNote: '  Call now or your account closes.  ',
        }),
      ),
    );
    expect(checkNote).toHaveBeenCalledExactlyOnceWith(
      'Call now or your account closes.',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(assessment);
  });

  it('rejects malformed JSON before calling the model', async () => {
    const response = await POST(request('{invalid'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON' });
    expect(checkNote).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { version: 1, sellerNote: ' ' },
    { version: 2, sellerNote: 'Note' },
    { version: 1, sellerNote: 'Note', rawNote: 'private data' },
    { version: 1, sellerNote: 'a'.repeat(10_001) },
  ])('rejects invalid input before a model request %#', async (payload) => {
    const response = await POST(request(JSON.stringify(payload)));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid analysis payload',
    });
    expect(checkNote).not.toHaveBeenCalled();
  });

  it('returns HTTP 503 without exposing provider errors or faking an assessment', async () => {
    vi.mocked(checkNote).mockRejectedValue(
      new Error('Private provider response and credentials'),
    );
    const response = await POST(
      request(JSON.stringify({ version: 1, sellerNote: 'Synthetic note' })),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'AI analysis unavailable' });
  });

  it('logs a safe development timeout diagnostic without dumping error details', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Private request text and credentials');
    error.name = 'TimeoutError';
    vi.mocked(checkNote).mockRejectedValue(error);
    const response = await POST(
      request(JSON.stringify({ version: 1, sellerNote: 'Synthetic note' })),
    );
    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledTimes(1);
    const [label, details] = log.mock.calls[0]!;
    expect(label).toBe('[Pay Guardian] AI analysis failed');
    expect(JSON.parse(details as string)).toMatchObject({
      stage: 'model_request',
      timeout: true,
    });
    expect(details).not.toContain('Private request text');
    expect(details).not.toContain('credentials');
    expect(await response.json()).toEqual({ error: 'AI analysis unavailable' });
  });

  it('logs only selected provider metadata during development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(checkNote).mockRejectedValue(
      new APICallError({
        message: 'Private provider error',
        url: 'https://private.example',
        statusCode: 429,
        requestBodyValues: { sellerNote: 'Private note' },
        responseBody: 'Private response body',
      }),
    );
    await POST(
      request(JSON.stringify({ version: 1, sellerNote: 'Synthetic note' })),
    );
    const details = log.mock.calls[0]![1] as string;
    expect(JSON.parse(details)).toMatchObject({
      httpStatus: 429,
      stage: 'model_request',
    });
    expect(details).not.toContain('Private');
    expect(details).not.toContain('private.example');
  });

  it('does not emit development diagnostics in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(checkNote).mockRejectedValue(new Error('Private provider error'));
    await POST(
      request(JSON.stringify({ version: 1, sellerNote: 'Synthetic note' })),
    );
    expect(log).not.toHaveBeenCalled();
  });
});
