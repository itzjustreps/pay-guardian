import { validateAnalysisPayload } from '@/extension/utils/analysis-payload';
import { checkNote } from '@/lib/ai-checkNote';
import { APICallError, NoObjectGeneratedError } from 'ai';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateAnalysisPayload(body); //validate payload structure x
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid analysis payload' },
      { status: 400 },
    );
  }

  const started = Date.now();
  try {
    const assessment = await checkNote(validation.data.sellerNote); //send the notes to checknote where we then send to the ai model
    return Response.json(assessment, {
      headers: { 'Cache-Control': 'no-store' }, //WHAT IS THIS?
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      const knownMessages = new Set([
        'GOOGLE_GENERATIVE_AI_API_KEY is not configured',
        'GOOGLE_GENERATIVE_AI_MODEL is not configured',
        'Invalid note for AI analysis',
        'Invalid AI response',
        'AI response exceeded the supported check scope',
        'AI evidence was not found in the submitted note',
      ]);
      const knownMessage =
        error instanceof Error && knownMessages.has(error.message)
          ? error.message
          : undefined;
      const providerError = APICallError.isInstance(error);
      const invalidOutput = NoObjectGeneratedError.isInstance(error);

      // Log selected metadata only. SDK errors can contain the complete prompt,
      // generated text, request headers, and provider response bodies.
      const diagnostic = {
        stage: knownMessage
          ? 'local_validation'
          : invalidOutput
            ? 'structured_output'
            : 'model_request',
        reason:
          knownMessage ??
          (invalidOutput
            ? 'No valid structured output generated'
            : providerError && error.statusCode === 503
              ? 'Model provider temporarily unavailable'
              : providerError && error.statusCode === 429
                ? 'Provider quota or rate limit reached'
                : 'Model request failed'),
        httpStatus: providerError ? error.statusCode : undefined,
        elapsedMs: Date.now() - started,
        timeout:
          error instanceof Error &&
          ['TimeoutError', 'AbortError'].includes(error.name),
        hasApiKey: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()),
        hasModel: Boolean(process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim()),
      };
      console.error(
        '[Pay Guardian] AI analysis failed',
        JSON.stringify(diagnostic),
      );
    }
    // Do not return provider errors, prompts, credentials, or note text.
    // A failed analysis must not become an assessment with no warning signs.
    return Response.json(
      { error: 'AI analysis unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
