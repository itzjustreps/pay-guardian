import { validateAnalysisPayload } from '@/extension/utils/analysis-payload'; //to run validation again.
import { aiResponseSchema } from '@/lib/ai-response';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: 'Invalid JSON',
      },
      { status: 400 },
    );
  }
  const validation = validateAnalysisPayload(body);
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid analysis payload' },
      { status: 400 },
    );
  }
  const validatedNotes: string = validation.data.sellerNote;

  // Inspect synthetic test notes in the backend terminal during development.
  if (process.env.NODE_ENV === 'development') {
    console.log('[Pay Guardian] Received seller note:', validatedNotes);
  }

  // Server fetch needs an absolute URL. Use trusted configuration, not the
  // request's Host header, so callers cannot choose where notes are forwarded.
  const baseUrl =
    process.env.APP_BASE_URL?.trim() ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'
      : undefined);
  if (!baseUrl) {
    return Response.json({ error: 'AI analysis unavailable' }, { status: 503 });
  }

  try {
    const res = await fetch(new URL('/api/ai-query', baseUrl).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validation.data),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });

    if (!res.ok) {
      return Response.json(
        { error: 'AI analysis unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let result: unknown;
    try {
      result = await res.json();
    } catch {
      return Response.json(
        { error: 'Invalid AI analysis response' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const analysis = aiResponseSchema.safeParse(result);
    if (!analysis.success) {
      return Response.json(
        { error: 'Invalid AI analysis response' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return Response.json(
      { status: 'received', analysis: analysis.data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'AI analysis unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
