import { describe, expect, it } from 'vitest';
import {
  MAX_SELLER_NOTE_LENGTH,
  validateAnalysisPayload,
} from '../extension/utils/analysis-payload';
import { redactSellerNote } from '../extension/utils/redact-note';
import { readSellerNote } from '../extension/utils/seller-note';

describe('analysis payload validation', () => {
  it('accepts the supported version and trims surrounding whitespace', () => {
    const result = validateAnalysisPayload({
      version: 1,
      sellerNote: '  URGENT call [PHONE_1]\nnow!  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        version: 1,
        sellerNote: 'URGENT call [PHONE_1]\nnow!',
      });
    }
  });

  it.each([
    null,
    undefined,
    'a note',
    [],
    {},
    { version: 1 },
    { sellerNote: 'Note' },
    { version: '1', sellerNote: 'Note' },
    { version: 2, sellerNote: 'Note' },
    { version: 1, sellerNote: 123 },
    { version: 1, sellerNote: '' },
    { version: 1, sellerNote: ' \n\t ' },
    { version: 1, sellerNote: 'Note', rawNote: 'personal information' },
  ])('rejects invalid payload %#', (input) => {
    expect(validateAnalysisPayload(input).success).toBe(false);
  });

  it('accepts the size boundary and rejects longer notes without truncation', () => {
    expect(
      validateAnalysisPayload({
        version: 1,
        sellerNote: 'a'.repeat(MAX_SELLER_NOTE_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      validateAnalysisPayload({
        version: 1,
        sellerNote: 'a'.repeat(MAX_SELLER_NOTE_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('builds a redacted payload from an extracted synthetic seller note', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="notes-container"><p class="label">Note from seller</p><p>PayPal Support: URGENT call 07700900123 or email john@example.com!</p></div>';
    const note = readSellerNote(root);
    expect(note.status).toBe('ready');
    if (note.status !== 'ready') throw new Error('Fixture note was not found');

    const result = validateAnalysisPayload({
      version: 1,
      sellerNote: redactSellerNote(note.text),
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Fixture payload was rejected');

    expect(result.data).toEqual({
      version: 1,
      sellerNote: 'PayPal Support: URGENT call [PHONE_1] or email [EMAIL_1]!',
    });
    const serialised = JSON.stringify(result.data);
    expect(serialised).not.toContain('07700900123');
    expect(serialised).not.toContain('john@example.com');
  });

  it('does not claim that a structurally valid payload contains no PII', () => {
    expect(
      validateAnalysisPayload({ version: 1, sellerNote: 'Call 07700900123' })
        .success,
    ).toBe(true);
  });
});
