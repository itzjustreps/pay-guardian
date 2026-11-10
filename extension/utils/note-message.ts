import { z } from 'zod';
import { aiResponseSchema } from '../../lib/ai-response';
import { analysisPayloadSchema } from './analysis-payload';

export const noteMessageSchema = z.strictObject({
  type: z.literal('SEND_NOTE'),
  payload: analysisPayloadSchema, //version and sellernote
});

export const noteReplySchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), assessment: aiResponseSchema }),
  z.strictObject({ ok: z.literal(false) }),
]);
export type NoteReply = z.infer<typeof noteReplySchema>;

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
