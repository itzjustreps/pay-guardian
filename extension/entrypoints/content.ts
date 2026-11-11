import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { watchSellerNote } from '../utils/seller-note';
import { redactSellerNoteWithContacts } from '../utils/redact-note';
import { validateAnalysisPayload } from '../utils/analysis-payload';
import { noteReplySchema } from '../utils/note-message';
import {
  createAssessmentPanel,
  assessmentPanelCss,
} from '../utils/assessment-panel';

export default defineContentScript({
  matches: ['https://www.sandbox.paypal.com/invoice/p/*'],
  async main(ctx) {
    console.log('[Pay Guardian] Invoice page detected');
    // Keep contact flags locally; only redacted text is sent to the backend.
    let preparedNote = redactSellerNoteWithContacts('');
    let isChecking = false;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Loading…';
    button.disabled = true;
    const panel = createAssessmentPanel(button);
    panel.showMessage('Looking for the seller note…');

    async function startAssessment() {
      if (isChecking || !preparedNote.text || ctx.isInvalid) return;
      const payload = {
        version: 1,
        sellerNote: preparedNote.text,
      };
      const validation = validateAnalysisPayload(payload);

      if (!validation.success) {
        // Validation errors may contain input details: log a fixed message.
        panel.showMessage(
          'The seller note could not be checked because it is empty or too long.',
        );
        console.warn('[Pay Guardian] Invalid analysis payload; stopped');
        return;
      }
      panel.showMessage('Checking the seller note…');
      isChecking = true;
      button.disabled = true;
      button.textContent = 'Checking…';
      button.setAttribute('aria-busy', 'true');
      try {
        const reply: unknown = await browser.runtime.sendMessage({
          //sends message to the background.ts file
          type: 'SEND_NOTE',
          payload: validation.data,
        });
        if (ctx.isInvalid) return;
        const response = noteReplySchema.safeParse(reply);
        if (!response.success || !response.data.ok) {
          panel.showMessage('The check is unavailable. Please try again.');
          console.warn('[Pay Guardian] Seller-note analysis unavailable');
          return;
        }

        panel.showAssessment(response.data.assessment, preparedNote);
        console.log(
          '[Pay Guardian] Seller-note analysis complete (urgency only)',
          {
            status: response.data.assessment.status,
            findingCount: response.data.assessment.findings.length,
          },
        );
      } catch {
        if (!ctx.isInvalid)
          panel.showMessage('Could not complete the check. Please try again.');
        console.warn('[Pay Guardian] Could not contact the background script');
      } finally {
        isChecking = false;
        button.disabled = false;
        button.textContent = 'Check invoice';
        button.removeAttribute('aria-busy');
      }
    }
    button.addEventListener('click', () => {
      void startAssessment();
    });

    // Shadow DOM keeps PayPal's styles separate from our button.
    const ui = await createShadowRootUi(ctx, {
      name: 'pay-guardian-button',
      position: 'inline',
      anchor: 'body',
      css: assessmentPanelCss,
      onMount(container) {
        container.append(panel.element);
      },
    });
    // WXT automatically removes this UI when the context is invalidated.
    if (ctx.isInvalid) return;
    ui.mount();

    const stop = watchSellerNote((result) => {
      button.textContent = 'Unavailable';
      button.disabled = true;
      // Log status only: seller notes can contain personal information.
      switch (result.status) {
        case 'ready': {
          preparedNote = redactSellerNoteWithContacts(result.text);
          panel.showMessage(
            preparedNote.text.trim()
              ? 'Ready to check this seller note.'
              : 'There is no seller note text to check.',
          );
          button.disabled = preparedNote.text.trim().length === 0;
          button.textContent = button.disabled
            ? 'Unavailable'
            : 'Check invoice';
          break;
        }
        case 'empty':
          panel.showMessage('There is no seller note text to check.');
          console.log('[Pay Guardian] Seller note is empty');
          break;
        case 'missing':
          panel.showMessage(
            'Could not find a seller note. Refresh the invoice page to try again.',
          );
          console.warn(
            '[Pay Guardian] Seller note not found within 10 seconds',
          );
          break;
        case 'ambiguous':
          panel.showMessage(
            'Multiple seller notes were found, so the check could not start.',
          );
          console.warn(
            '[Pay Guardian] Multiple seller notes found; extraction stopped',
          );
          break;
      }
    });
    ctx.onInvalidated(stop); // Clean up when WXT unloads or replaces this script.
  },
});
