import { z } from 'zod';

export const MAX_SELLER_NOTE_LENGTH = 10_000;

export const analysisPayloadSchema = z.strictObject({
  version: z.literal(1),
  sellerNote: z.string().max(MAX_SELLER_NOTE_LENGTH).trim().min(1),
});

export type AnalysisPayload = z.infer<typeof analysisPayloadSchema>;

// Accept unknown so callers cannot bypass runtime checks using a TypeScript type.
// This validates structure and size, not whether redaction removed all PII.
export function validateAnalysisPayload(input: unknown) {
  return analysisPayloadSchema.safeParse(input);
}
