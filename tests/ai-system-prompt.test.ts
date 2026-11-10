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
