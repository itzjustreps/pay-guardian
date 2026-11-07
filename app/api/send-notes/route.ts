import { validateAnalysisPayload } from '@/extension/utils/analysis-payload'; //to run validation again.

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

  // Inspect synthetic test notes in the backend terminal during development.
  if (process.env.NODE_ENV === 'development') {
    console.log(
      '[Pay Guardian] Received seller note:',
      validation.data.sellerNote,
    );
  }

  return Response.json({ status: 'received' });
}
