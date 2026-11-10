import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { validateAnalysisPayload } from '@/extension/utils/analysis-payload';
import { aiResponseSchema, type AiResponse } from './ai-response';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt';

// Server-side helper: call Gemini directly rather than fetching our own API.
export async function checkNote(note: string): Promise<AiResponse> {
  const input = validateAnalysisPayload({ version: 1, sellerNote: note });

  if (!input.success) throw new Error('Invalid note for AI analysis');
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    //checks the api key
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
  }

  const modelId = process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim();

  if (!modelId) {
    throw new Error('GOOGLE_GENERATIVE_AI_MODEL is not configured');
  }

  const sellerNote = input.data.sellerNote;
  const result = await generateText({
    model: google(modelId),
    system: AI_SYSTEM_PROMPT,
    prompt: JSON.stringify({ sellerNote }),
    output: Output.object({ schema: aiResponseSchema }),
    maxOutputTokens: 2_048,
    maxRetries: 0,
    // Model deadline < backend forwarding deadline < extension deadline.
    timeout: 20_000,
    providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } }, //low latency
    experimental_telemetry: { isEnabled: false },
  });
  // Runtime validation also enforces the schema's cross-field refinement.
  const validation = aiResponseSchema.safeParse(result.output);
  if (!validation.success) throw new Error('Invalid AI response');
  const assessment = validation.data;
  console.log('THIS IS AI OUTPUT:', result.output.findings);

  // The schema supports future categories; this prompt currently checks urgency only.
  if (
    assessment.findings.length > 1 ||
    assessment.findings.some((finding) => finding.category !== 'urgency')
  ) {
    throw new Error('AI response exceeded the urgency-only scope');
  }
  if (
    assessment.findings.some(
      (finding) => !sellerNote.includes(finding.evidence),
    )
  ) {
    throw new Error('AI evidence was not found in the submitted note');
  }

  return assessment;
}
