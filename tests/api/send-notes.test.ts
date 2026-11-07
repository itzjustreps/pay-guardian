import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/send-notes/route';
import { MAX_SELLER_NOTE_LENGTH } from '../../extension/utils/analysis-payload';

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
    'acknowledges receipt without judging or echoing the note %#',
    async (sellerNote) => {
      const response = await postPayload({ version: 1, sellerNote });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'application/json',
      );
      expect(await response.json()).toEqual({ status: 'received' });
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
    },
  );

  it('accepts a note at the length limit', async () => {
    const response = await postPayload({
      version: 1,
      sellerNote: 'a'.repeat(MAX_SELLER_NOTE_LENGTH),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'received' });
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
  });
});
