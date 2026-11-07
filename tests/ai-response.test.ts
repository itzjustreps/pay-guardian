import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aiResponseSchema } from '../lib/ai-response';

const finding = {
  category: 'urgency',
  evidence: 'Call [PHONE_1] immediately or your account will be suspended.',
  explanation: 'Threatens account suspension to pressure immediate contact.',
};
const response = {
  status: 'analysed',
  summary: 'The note uses pressure to encourage immediate contact.',
  findings: [finding],
};

describe('AI response schema', () => {
  it('accepts a structured assessment with supporting evidence', () => {
    expect(aiResponseSchema.safeParse(response).success).toBe(true);
  });

  it('accepts no findings without requiring the model to invent a concern', () => {
    expect(
      aiResponseSchema.safeParse({
        status: 'analysed',
        summary:
          'No strong social engineering signals were detected in the note.',
        findings: [],
      }).success,
    ).toBe(true);
  });

  it('distinguishes insufficient context from an assessment with no findings', () => {
    expect(
      aiResponseSchema.safeParse({
        status: 'insufficient_context',
        summary: 'The note contains too little readable content to assess.',
        findings: [],
      }).success,
    ).toBe(true);
    expect(
      aiResponseSchema.safeParse({
        ...response,
        status: 'insufficient_context',
      }).success,
    ).toBe(false);
  });

  it.each([
    'urgency',
    'impersonation',
    'contact_redirection',
    'sensitive_information_request',
    'payment_diversion',
  ])('accepts the agreed category %s', (category) => {
    expect(
      aiResponseSchema.safeParse({
        ...response,
        findings: [{ ...finding, category }],
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...response, status: 'safe' },
    { ...response, summary: '   ' },
    { ...response, summary: 'a'.repeat(301) },
    { ...response, findings: finding },
    { ...response, findings: Array.from({ length: 6 }, () => finding) },
    { ...response, findings: [{ ...finding, category: 'admin-jargon' }] },
    { ...response, findings: [{ ...finding, evidence: '   ' }] },
    { ...response, findings: [{ ...finding, evidence: 'a'.repeat(501) }] },
    { ...response, findings: [{ ...finding, explanation: '   ' }] },
    { ...response, findings: [{ ...finding, explanation: 'a'.repeat(501) }] },
    { ...response, findings: [{ ...finding, confidence: 0.99 }] },
    { ...response, riskScore: 99 },
    { status: 'analysed', findings: [] },
    { status: 'analysed', summary: 'No findings' },
  ])('rejects invalid output %#', (input) => {
    expect(aiResponseSchema.safeParse(input).success).toBe(false);
  });

  it('can describe its structural rules as JSON Schema for model integration', () => {
    const jsonSchema = z.toJSONSchema(aiResponseSchema);
    expect(jsonSchema.type).toBe('object');
    // The cross-field refinement still needs runtime validation after generation.
    expect(jsonSchema.additionalProperties).toBe(false);
  });
});
