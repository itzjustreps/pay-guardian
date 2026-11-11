import { describe, expect, it } from 'vitest';
import {
  redactSellerNote,
  redactSellerNoteWithContacts,
} from '../extension/utils/redact-note';

describe('seller note redaction', () => {
  it.each([
    ['Call +44 7700 900123.', true, false],
    ['Email help@example.com.', false, true],
    [
      'Call 07700900123 or email help@example.com now or your account closes.',
      true,
      true,
    ],
    ['Email 07700900123@example.com.', false, true],
    ['Pay $1,200.00 within 24 hours.', false, false],
    ['', false, false],
    ['Call [PHONE_1] or email [EMAIL_1].', false, false],
  ])(
    'retains contact flags for %s',
    (note, hasPhoneNumber, hasEmailAddress) => {
      expect(redactSellerNoteWithContacts(note)).toEqual({
        text: redactSellerNote(note),
        hasPhoneNumber,
        hasEmailAddress,
      });
    },
  );

  it('does not carry contact flags into the next note', () => {
    redactSellerNoteWithContacts('Call 07700900123 or email help@example.com.');
    expect(redactSellerNoteWithContacts('Payment due in 14 days.')).toEqual({
      text: 'Payment due in 14 days.',
      hasPhoneNumber: false,
      hasEmailAddress: false,
    });
  });
  it('preserves brand claims and pressure while replacing contact details', () => {
    expect(
      redactSellerNote(
        'PayPal Support: URGENT call 07700900123 or email john@example.com now!',
      ),
    ).toBe('PayPal Support: URGENT call [PHONE_1] or email [EMAIL_1] now!');
  });

  it.each([
    '07700900123',
    '+44 7700 900123',
    '+1 (800) 555-0199',
    '(020) 7946 0958',
    '800.555.0199',
    '0-7-7-0-0-9-0-0-1-2-3',
  ])('redacts the common phone format %s', (phone) => {
    expect(redactSellerNote(`Call ${phone} immediately.`)).toBe(
      'Call [PHONE_1] immediately.',
    );
  });

  it('uses consistent placeholders for repeated contacts', () => {
    expect(
      redactSellerNote(
        'Call +44 7700 900123 or +447700900123. Email help@example.com; repeat help@example.com.',
      ),
    ).toBe('Call [PHONE_1] or [PHONE_1]. Email [EMAIL_1]; repeat [EMAIL_1].');
  });

  it('numbers distinct contacts separately and preserves punctuation', () => {
    expect(
      redactSellerNote(
        'Email first+support@example.co.uk, or second@other.example! Call 07700900123 or 07700900456.',
      ),
    ).toBe('Email [EMAIL_1], or [EMAIL_2]! Call [PHONE_1] or [PHONE_2].');
  });

  it('redacts emails before checking phone-like digits inside them', () => {
    expect(redactSellerNote('Email 07700900123@example.com.')).toBe(
      'Email [EMAIL_1].',
    );
  });

  it('preserves empty notes, ordinary amounts, deadlines, and line breaks', () => {
    expect(redactSellerNote('')).toBe('');
    const note = 'Pay $1,200.00 within 24 hours.\nInvoice has 3 items.';
    expect(redactSellerNote(note)).toBe(note);
    expect(redactSellerNote('Call 07700900123\nThen call 07700900456')).toBe(
      'Call [PHONE_1]\nThen call [PHONE_2]',
    );
  });

  it('starts numbering again for each note', () => {
    expect(redactSellerNote('first@example.com')).toBe('[EMAIL_1]');
    expect(redactSellerNote('second@example.com')).toBe('[EMAIL_1]');
  });
});
