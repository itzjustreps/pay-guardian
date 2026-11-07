import { z } from 'zod';

const findingSchema = z.strictObject({
  category: z.enum([
    'urgency',
    'impersonation',
    'contact_redirection',
    'sensitive_information_request',
    'payment_diversion',
  ]),
  evidence: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      'An exact quote from the redacted seller note supporting this finding.',
    ),
  explanation: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      'Explain the concern in context without claiming fraud is proven.',
    ),
});

export const aiResponseSchema = z
  .strictObject({
    status: z.enum(['analysed', 'insufficient_context']),
    summary: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .describe(
        'A short, cautious summary of the seller-note assessment, or why context is insufficient.',
      ),
    // An empty array is valid: the model must not invent a finding to fill it.
    findings: z.array(findingSchema).max(5),
  })
  .refine(
    (response) =>
      response.status !== 'insufficient_context' ||
      response.findings.length === 0,
    {
      message: 'Insufficient context must not include findings',
      path: ['findings'],
    },
  );

export type AiResponse = z.infer<typeof aiResponseSchema>;

// Risk scoring and checking that evidence occurs in the submitted note belong
// in backend code. This schema alone cannot establish that a finding is true.
