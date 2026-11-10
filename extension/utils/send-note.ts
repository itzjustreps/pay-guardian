import { z } from 'zod';
import { aiResponseSchema, type AiResponse } from '../../lib/ai-response';
import {
  type AnalysisPayload,
  validateAnalysisPayload,
} from './analysis-payload';

// Development endpoint. Keep the destination fixed, never taken from page data.
const baseUrl = import.meta.env.WXT_API_BASE_URL;
if (!baseUrl) {
  throw new Error('WXT_API_BASE_URL is not configured');
}
const NOTE_ENDPOINT = new URL('/api/send-notes', baseUrl).href;

const noteResponseSchema = z.strictObject({
  status: z.literal('received'),
  analysis: aiResponseSchema,
});
// Call from the background script, after local redaction.
export async function sendNote(payload: AnalysisPayload): Promise<AiResponse> {
  const validation = validateAnalysisPayload(payload);
  if (!validation.success) {
    throw new Error('Invalid analysis payload');
  }

  const res = await fetch(NOTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validation.data),
    signal: AbortSignal.timeout(28_000),
    credentials: 'omit',
    redirect: 'error',
  });

  // fetch rejects for network failures, but not HTTP errors such as 400 or 500.
  if (!res.ok) {
    throw new Error(`Analysis request failed (HTTP ${res.status})`);
  }

  const body: unknown = await res.json();
  const response = noteResponseSchema.safeParse(body);
  if (!response.success) {
    throw new Error('Invalid analysis response from API');
  }
  return response.data.analysis;
}
