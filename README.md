# pay-guardian

Paypal Hackathon

## Problem

with the recent rise in paypal invoice scam

## Tests

Run `npm test` to execute the Vitest and React Testing Library suite once, or
`npm run test:watch` to rerun tests while developing. CI runs `npm test` on pushes
and pull requests and fails if a test fails.

Tests live in `tests/` and cover the home page content, resource link destinations,
and safe new-tab navigation. Add `*.test.ts` or `*.test.tsx` files for new features.

## AI analysis

AI checks cover urgency/coercive threats and requests to disclose authentication or payment-card secrets in redacted seller notes. Sensitive-information rules and examples live in `lib/ai-sensitive-information.ts`; the main prompt combines both checks in one request.
The prompt lives in `lib/ai-system-prompt.ts`; the server-side Gemini request and
evidence checks live in `lib/ai-checkNote.ts`.

Set `GOOGLE_GENERATIVE_AI_API_KEY` in the root `.env.local` (see `.env.example`).
Set `GOOGLE_GENERATIVE_AI_MODEL` to `gemini-3.8-flash`. Set `APP_BASE_URL` to the
origin of this Next.js backend (for example `http://localhost:3001`). Development
defaults to that origin if unset; production requires it explicitly. Restart
Next.js after changing environment settings. Keep the key out of the extension.

The extension calls `POST /api/send-notes`, which forwards the validated payload
to `POST /api/ai-query` and returns `{ status: "received", analysis: ... }`.
The separate AI endpoint accepts `{ "version": 1, "sellerNote": "redacted note" }`
and returns the validated assessment. Invalid input returns HTTP 400; unavailable
analysis returns HTTP 503; a malformed response from the AI endpoint returns HTTP 502. The background script passes the assessment back to the content script,
which displays the summary, evidence, and explanations in an on-page panel. Contact safety advice appears only for analysed notes with no findings and detected contact details.

Tests mock model responses and make no paid AI calls. Prompt examples demonstrate
the expected format; they do not establish detector accuracy. Evaluate the model
on separate legitimate, suspicious, ambiguous, and adversarial notes before
making accuracy claims. No risk score or full invoice assessment is produced yet.
