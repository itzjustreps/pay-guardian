import { describe, expect, it } from 'vitest';
import {
  isSandboxInvoice,
  noteMessageSchema,
  noteReplySchema,
} from '../extension/utils/note-message';

describe('note messages', () => {
  it('accepts only the expected action and payload shape', () => {
    const valid = {
      type: 'SEND_NOTE',
      payload: { version: 1, sellerNote: 'Call [PHONE_1]' },
    };
    expect(noteMessageSchema.safeParse(valid).success).toBe(true);
    expect(
      noteMessageSchema.safeParse({ ...valid, url: 'https://attacker.example' })
        .success,
    ).toBe(false);
    expect(
      noteMessageSchema.safeParse({ ...valid, type: 'FETCH_URL' }).success,
    ).toBe(false);
    expect(
      noteMessageSchema.safeParse({ ...valid, payload: 'a bare note' }).success,
    ).toBe(false);
  });

  it('checks replies rather than trusting truthy values', () => {
    expect(noteReplySchema.safeParse({ ok: true }).success).toBe(true);
    expect(noteReplySchema.safeParse({ ok: false }).success).toBe(true);
    expect(noteReplySchema.safeParse({ ok: 'false' }).success).toBe(false);
  });

  it.each([
    undefined,
    'not a URL',
    'http://www.sandbox.paypal.com/invoice/p/example',
    'https://www.sandbox.paypal.com.attacker.example/invoice/p/example',
    'https://www.sandbox.paypal.com@attacker.example/invoice/p/example',
    'https://www.sandbox.paypal.com/other-page',
  ])('rejects an unsupported sender URL %#', (url) => {
    expect(isSandboxInvoice(url)).toBe(false);
  });

  it('accepts a sandbox invoice without needing to transmit its identifier', () => {
    expect(
      isSandboxInvoice('https://www.sandbox.paypal.com/invoice/p/#example'),
    ).toBe(true);
  });
});
