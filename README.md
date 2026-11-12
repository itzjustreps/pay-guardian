# Pay Guardian

**An AI-powered Chrome extension that helps people recognise social-engineering warning signs in PayPal invoice notes.**

**[Download Pay Guardian for Chrome — ZIP](downloads/pay-guardian-production.zip?raw=true)** · Includes installation instructions and five test invoice links.

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

### Try it in Chrome

1. **[Download the extension ZIP](downloads/pay-guardian-production.zip?raw=true)** and unzip it. If GitHub opens a file page, click **Download raw file**.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted `pay-guardian` folder containing `manifest.json`.
4. Open `TEST-INVOICES.html` inside that folder in Chrome and choose a test invoice.
5. Click **Check invoice** in the panel on the invoice page.

No local server, API key, or coding setup is needed. `START-HERE.txt` in the ZIP includes troubleshooting. Use the panel on the invoice page; the toolbar popup is still a starter screen.

The extension currently matches `https://www.sandbox.paypal.com/invoice/p/*`. Opening the backend website alone does not install or demonstrate the extension. Refresh an invoice tab after installing or reloading it. To reopen a dismissed panel, refresh the page.

## What it checks

| Check                          | What it looks for                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urgency and pressure           | Coercive demands to act immediately, linked to threats such as account closure. Ordinary payment deadlines are not enough on their own.                                                             |
| Sensitive-information requests | Requests to disclose passwords, PINs, login/security codes, recovery codes, full card numbers, or card security codes. Protective advice such as “Never share your password” should not be flagged. |

A note can trigger either or both checks, with a separate explanation for each finding. Contact details alone do not count as a warning. The contact guidance explains how to verify details independently and avoid sharing secrets, granting remote access, or acting under payment pressure.

## Using the test invoices

The ZIP includes `TEST-INVOICES.html` with five labelled examples:

| Invoice               | Expected result                                                     |
| --------------------- | ------------------------------------------------------------------- |
| Urgency               | A red warning about pressure to act immediately.                    |
| Sensitive information | A red warning about a request to disclose account secrets.          |
| Both warnings         | Separate findings for urgency and sensitive information.            |
| Contact safety advice | No warning findings, with blue guidance before calling or emailing. |
| Legitimate note       | No warning findings or contact advice.                              |

These are sandbox examples; no real payment is needed. AI wording may vary. If PayPal asks you to sign in, ask the presenter for sandbox test-account instructions. Do not enter real passwords, security codes, or card details into test notes.

## Troubleshooting

- **The panel does not appear:** confirm the extension is enabled and you are on a supported sandbox invoice page, then refresh the tab.
- **The button says “Unavailable”:** read the message in the panel. The seller note may be missing, empty, or ambiguous.
- **The check fails:** check your internet connection and try again. If the problem continues, contact the presenter.
- **The panel was closed:** refresh the invoice page to show it again.
- **Chrome will not let you install the extension:** a managed browser may restrict extensions. Ask the presenter for a demonstration.

To remove Pay Guardian, open `chrome://extensions` and select **Remove** on its card.

## Privacy and limitations

Pay Guardian checks the seller note only. Common phone numbers and email addresses are replaced with placeholders on your device before the note is sent to the hosted backend and AI provider. This redaction is partial: disguised contact details and other personal information may remain. An internet connection is required for analysis.

The extension does not verify the sender or contact owner, check the entire invoice, or analyse what happens during a subsequent call or email exchange. It currently supports sandbox invoice pages only.

AI can miss suspicious wording or flag legitimate wording. **No findings does not mean the invoice is safe.** Use the explanations to inform your decision and verify unexpected requests independently through PayPal’s official app or website.
