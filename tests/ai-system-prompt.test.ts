import { SENSITIVE_INFORMATION_EXAMPLES } from '../lib/ai-sensitive-information';
import { describe, expect, it } from 'vitest';
import { aiResponseSchema } from '../lib/ai-response';
import { URGENCY_EXAMPLES } from '../lib/ai-system-prompt';

describe('urgency prompt examples', () => {
  it.each(URGENCY_EXAMPLES)(
    'uses valid structured output and genuine quotes for example %#',
    ({ note, response }) => {
      expect(aiResponseSchema.safeParse(response).success).toBe(true);
      for (const finding of response.findings) {
        expect(finding.category).toBe('urgency');
        expect(note).toContain(finding.evidence);
      }
    },
  );
});

describe('sensitive-information prompt examples', () => {
  it.each(SENSITIVE_INFORMATION_EXAMPLES)(
    'uses valid output, unique enabled categories and exact evidence for example %#',
    ({ note, response }) => {
      expect(aiResponseSchema.safeParse(response).success).toBe(true);
      expect(response.findings.length).toBeLessThanOrEqual(2);
      expect(
        new Set(response.findings.map((finding) => finding.category)).size,
      ).toBe(response.findings.length);
      for (const finding of response.findings) {
        expect(['urgency', 'sensitive_information_request']).toContain(
          finding.category,
        );
        expect(note).toContain(finding.evidence);
      }
    },
  );
});
