import { z } from 'zod';
import { analysisPayloadSchema } from './analysis-payload';

export const noteMessageSchema = z.strictObject({
  type: z.literal('SEND_NOTE'),
  payload: analysisPayloadSchema, //version and sellernote
});

// Successful delivery is an acknowledgement, not an AI risk assessment.
export const noteReplySchema = z.strictObject({ ok: z.boolean() });

export function isSandboxInvoice(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === 'https://www.sandbox.paypal.com' &&
      parsed.pathname.startsWith('/invoice/p/')
    );
  } catch {
    return false;
  }
}
