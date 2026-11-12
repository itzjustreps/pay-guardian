# Pay Guardian

**An AI-powered Chrome extension that helps people recognise social-engineering warning signs in PayPal invoice notes.**

## Why I built Pay Guardian

I built Pay Guardian for everyday users who may not have the awareness or education to recognise an invoice scam. A convincing invoice can persuade someone to call a number, disclose sensitive information, or take an action that costs them money before they realise what is happening.

Someone with technical knowledge may already know which warning signs to look for. But that knowledge should not be a requirement for staying safe. Pay Guardian is for everyone, with particular attention to people who have not been taught how these tactics work.

**That is why I chose a Chrome extension.** The people I want to help should not have to deploy an application, run a local server, or understand the technology behind it. With the extension installed and connected to the hosted backend, they can open an invoice and click **Check invoice**. The guidance appears directly on the page they are already using.

My aim is for Pay Guardian to act as a last line of defence before someone follows a harmful instruction: highlight the concerning words, explain the risk in plain language, and give practical advice. It cannot catch every scam, but it can help people make a more informed decision at the moment it matters.

Built for the PayPal hackathon, the current prototype works on **PayPal sandbox invoice pages**.

## How it works

1. Open a supported sandbox invoice. A Pay Guardian panel appears at the top-right of the page.
2. Click **Check invoice**. Common phone numbers and email addresses are redacted locally before the note is sent to the backend for AI analysis.
3. Read the assessment, including the quoted evidence and an explanation for each finding. Warning findings receive red styling.
4. If neither check finds a warning and the note contains detected contact details, a blue **Before contacting the sender** section gives practical safety advice. Missing notes, insufficient context, and failed requests are shown separately.

**For judges and testers:** use the supplied production extension ZIP. Unzip it, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`. Then open a supplied sandbox invoice link and click **Check invoice**. No local server or API key is needed when using a build configured for the hosted backend.

The extension currently matches `https://www.sandbox.paypal.com/invoice/p/*`. Opening the backend website alone does not install or demonstrate the extension. Refresh an invoice tab after installing or reloading it. To reopen a dismissed panel, refresh the page.

## What it checks

| Check                          | What it looks for                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urgency and pressure           | Coercive demands to act immediately, linked to threats such as account closure. Ordinary payment deadlines are not enough on their own.                                                             |
| Sensitive-information requests | Requests to disclose passwords, PINs, login/security codes, recovery codes, full card numbers, or card security codes. Protective advice such as “Never share your password” should not be flagged. |

Both checks run in one AI request and can produce separate findings. Contact details alone do not count as a warning. The contact guidance explains how to verify details independently and avoid sharing secrets, granting remote access, or acting under payment pressure.

## Build the extension for the hosted backend

Use Node.js 24 and npm. From the repository root:

```bash
npm ci --prefix extension
```

Create `extension/.env.production`:

```env
WXT_API_BASE_URL=https://pay-guardian-oiwh.vercel.app
```

Build:

```bash
npm run build --prefix extension
```

In Chrome, load `extension/.output/chrome-mv3` using **Load unpacked**. On macOS, use **Command + Shift + G** in the folder picker and paste the full path if `.output` is hidden. After rebuilding, click **Reload** on the extension and refresh the invoice page.

To share a test build, zip the `chrome-mv3` folder with `manifest.json` directly inside it. Recipients must unzip it before loading it. Share sandbox invoice links you have checked in a fresh browser profile, along with any sandbox sign-in requirements. Never distribute your `.env` files or API key.

## Run locally

Install both projects’ dependencies from the repository root:

```bash
npm ci
npm ci --prefix extension
```

Copy `.env.example` to `.env.local`, then set:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your-server-side-key
GOOGLE_GENERATIVE_AI_MODEL=your-supported-model-id
APP_BASE_URL=http://localhost:3001
```

Create `extension/.env.local` with:

```env
WXT_API_BASE_URL=http://localhost:3001
```

Start the backend:

```bash
npm run dev -- --port 3001
```

In another terminal, start WXT:

```bash
npm run dev --prefix extension
```

Use the development browser opened by WXT to visit a sandbox invoice. The extension calls `/api/send-notes`, which validates the payload and forwards it to `/api/ai-query` for analysis.

## Deploy the backend to Vercel

Import the repository as a **Next.js** project with the repository root as its root directory:

| Setting          | Value                                 |
| ---------------- | ------------------------------------- |
| Install command  | `npm ci && npm ci --prefix extension` |
| Build command    | `npm run build`                       |
| Output directory | Leave the Next.js default.            |

Set `GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_GENERATIVE_AI_MODEL`, and `APP_BASE_URL` in Vercel. `APP_BASE_URL` must be the backend’s accessible production origin, including `https://`, because the server calls its own AI route. Redeploy after changing environment variables.

If you use a different backend domain, update both `WXT_API_BASE_URL` and `manifest.host_permissions` in `extension/wxt.config.ts`, then rebuild the extension. Backend prompt changes require a backend deployment; extension changes require rebuilding and reloading or redistributing the extension.

## Project structure

- `extension/entrypoints/content.ts` — invoice detection and check lifecycle.
- `extension/utils/assessment-panel.ts` — on-page results and safety guidance.
- `extension/utils/redact-note.ts` — contact redaction and local contact flags.
- `extension/entrypoints/background.ts` — extension message handling.
- `app/api/` — backend request validation and analysis endpoints.
- `lib/ai-system-prompt.ts` — shared prompt and urgency examples.
- `lib/ai-sensitive-information.ts` — sensitive-information rules and examples.
- `lib/ai-checkNote.ts` — model request, supported-category checks, and evidence validation.
- `tests/` — automated tests using mocked model responses.

The backend uses Next.js, TypeScript, the Vercel AI SDK, Gemini, and Zod. The extension uses WXT and TypeScript; the invoice panel uses DOM APIs inside Shadow DOM, while the popup uses React.

## Verification and limitations

Run from the repository root:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run compile --prefix extension
npm run build --prefix extension
```

Tests cover validation, redaction, message handling, API failures, and panel behaviour without paid AI calls. Passing tests does not establish live-model accuracy; test legitimate, suspicious, ambiguous, and adversarial notes separately against the deployed model.

API keys stay on the server. AI responses are validated with Zod, evidence must occur in the submitted note, and the panel renders model output as text rather than HTML. Redaction is partial: disguised contact details and other personal information may remain in text sent to the AI provider. The current backend has no application-level authentication or rate limiting, so public access needs additional protection before wider distribution.

This prototype checks seller-note language only. It does not verify contact ownership, analyse conversations after a call, assign a fraud probability, or support live PayPal invoice pages yet. No findings means neither implemented check found a supported warning—not that the invoice is safe.
