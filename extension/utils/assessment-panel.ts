import type { AiResponse } from '../../lib/ai-response';
import type { RedactedSellerNote } from './redact-note';

export const assessmentPanelCss = `
  .panel {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 2147483647;
    box-sizing: border-box;
    width: min(360px, calc(100vw - 48px));
    max-height: min(450px, calc(100dvh - 48px));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 20px;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    background: white;
    color: #172b4d;
    font: 14px/1.5 system-ui, sans-serif;
    overflow-wrap: anywhere;
    box-shadow: 0 8px 28px rgb(0 0 0 / 18%);
  }
  h2 { margin: 0 40px 8px 0; font-size: 18px; }
  h3 { margin: 16px 0 8px; font-size: 15px; }
  p { margin: 8px 0; }
  .contact-guidance {
    margin-top: 16px;
    padding: 12px;
    border-left: 3px solid #0070e0;
    border-radius: 6px;
    background: #eff6ff;
  }
  .contact-guidance h3 { margin-top: 0; }
  .contact-guidance ul { margin: 8px 0 0; padding-left: 20px; }
  .contact-guidance li + li { margin-top: 8px; }
  .panel.has-warnings { border-color: #b91c1c; }
  .has-warnings .result-heading {
    padding: 10px 12px;
    border-radius: 6px;
    background: #fef2f2;
    color: #991b1b;
  }
  .has-warnings article h3 { color: #991b1b; }
  .has-warnings blockquote {
    border-left-color: #b91c1c;
    background: #fef2f2;
  }
  .scope, .caution { color: #475569; font-size: 12px; }
  blockquote {
    margin: 8px 0;
    padding: 10px 12px;
    border-left: 3px solid #0070e0;
    background: #f1f5f9;
    white-space: pre-wrap;
  }
  button {
    width: 100%;
    margin-top: 12px;
    padding: 10px 16px;
    border: 0;
    border-radius: 8px;
    background: #003087;
    color: white;
    font: 600 14px/1.5 system-ui, sans-serif;
    cursor: pointer;
  }
  button:hover:not(:disabled) { background: #001c64; }
  button:disabled { opacity: 0.65; cursor: not-allowed; }
  button:focus-visible { outline: 3px solid #0070e0; outline-offset: 3px; }
  .close-button {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    background: transparent;
    color: #172b4d;
    font-size: 24px;
    line-height: 1;
  }
  .close-button:hover:not(:disabled) { background: #e2e8f0; }
`;

// All model and invoice content is rendered as text, never HTML.
function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

export function createAssessmentPanel(button: HTMLButtonElement) {
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-label', 'Pay Guardian invoice check');
  const closeButton = textElement('button', '×');
  closeButton.type = 'button';
  closeButton.className = 'close-button';
  closeButton.setAttribute('aria-label', 'Close assessment panel');
  closeButton.title = 'Close assessment panel';
  closeButton.addEventListener('click', () => panel.remove());
  const heading = textElement('h2', 'Pay Guardian');
  const scope = textElement(
    'p',
    'Checks seller notes for coercive urgency and requests for sensitive information.',
  );
  scope.className = 'scope';
  const results = document.createElement('div');
  results.setAttribute('role', 'status');
  results.setAttribute('aria-live', 'polite');
  results.setAttribute('aria-atomic', 'true');
  const caution = textElement(
    'p',
    'This check does not prove fraud or confirm that an invoice is safe.',
  );
  caution.className = 'caution';
  panel.append(closeButton, heading, scope, results, caution, button);

  return {
    element: panel,
    showMessage(message: string) {
      panel.classList.remove('has-warnings');
      results.replaceChildren(textElement('p', message));
    },
    showAssessment(
      assessment: AiResponse,
      contacts: Pick<RedactedSellerNote, 'hasPhoneNumber' | 'hasEmailAddress'>,
    ) {
      panel.classList.toggle(
        'has-warnings',
        assessment.status === 'analysed' && assessment.findings.length > 0,
      );
      const title =
        assessment.status === 'insufficient_context'
          ? 'Not enough context'
          : assessment.findings.length > 0
            ? 'Warning signs found'
            : 'No warning signs found in these checks';
      const resultHeading = textElement('h3', title);
      resultHeading.className = 'result-heading';
      results.replaceChildren(
        resultHeading,
        textElement('p', assessment.summary),
      );
      for (const finding of assessment.findings) {
        const item = document.createElement('article');
        item.append(
          textElement(
            'h3',
            finding.category === 'sensitive_information_request'
              ? 'Sensitive information requested'
              : finding.category === 'urgency'
                ? 'Urgency and pressure'
                : finding.category.replaceAll('_', ' '),
          ),
          textElement('strong', 'Evidence from the redacted note'),
          textElement('blockquote', finding.evidence),
          textElement('strong', 'Why it was flagged'),
          textElement('p', finding.explanation),
        );
        results.append(item);
      }
      if (
        assessment.status === 'analysed' &&
        assessment.findings.length === 0 &&
        (contacts.hasPhoneNumber || contacts.hasEmailAddress)
      ) {
        const guidance = document.createElement('section');
        guidance.className = 'contact-guidance';
        guidance.append(
          textElement('h3', 'Before contacting the sender'),
          textElement(
            'p',
            'Contact details were detected, but their owner has not been verified. No warning signs detected does not mean the contact is trustworthy.',
          ),
        );
        const advice = document.createElement('ul');
        for (const tip of [
          'Verify the phone number or email independently through the organisation’s official website or app.',
          'Never share passwords, one-time security codes, or recovery codes by phone or email.',
          'Do not install remote-access software or give someone control of your device.',
          'Do not send money or move funds because someone pressures you during a call or email exchange.',
        ]) {
          advice.append(textElement('li', tip));
        }
        guidance.append(advice);
        results.append(guidance);
      }
    },
  };
}
