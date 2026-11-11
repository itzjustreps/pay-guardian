import { watchSellerNote } from '../utils/seller-note';
import { redactSellerNote } from '../utils/redact-note';
import { validateAnalysisPayload } from '../utils/analysis-payload';
import { noteReplySchema } from '../utils/note-message';

export default defineContentScript({
  matches: ['https://www.sandbox.paypal.com/invoice/p/*'],
  async main(ctx) {
    console.log('[Pay Guardian] Invoice page detected');
    let redactedNotes = '';
    let isChecking = false;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Loading…';
    button.disabled = true;

    async function startAssessment() {
      if (isChecking || !redactedNotes || ctx.isInvalid) return;
      const payload = {
        version: 1,
        sellerNote: redactedNotes,
      };
      const validation = validateAnalysisPayload(payload);

      if (!validation.success) {
        // Validation errors may contain input details: log a fixed message.
        console.warn('[Pay Guardian] Invalid analysis payload; stopped');
        return;
      }
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
        const response = noteReplySchema.safeParse(reply);
        if (!response.success || !response.data.ok) {
          console.warn('[Pay Guardian] Seller-note analysis unavailable');
          return;
        }
        console.log(
          '[Pay Guardian] Seller-note analysis complete (urgency only)',
          {
            status: response.data.assessment.status,
            findingCount: response.data.assessment.findings.length,
          },
        );
      } catch {
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
      css: `
        button {
          position: fixed;
          right: 24px;
          top: 24px;
          z-index: 2147483647;
          box-sizing: border-box;
          width: 88px;
          height: 88px;
          display: grid;
          place-items: center;
          padding: 8px;
          border: 0;
          border-radius: 50%;
          background: #003087;
          color: white;
          font: 600 12px/1.4 system-ui, sans-serif;
          text-align: center;
          overflow-wrap: anywhere;
          box-shadow: 0 4px 16px rgb(0 0 0 / 20%);
          cursor: pointer;
        }
        button:hover:not(:disabled) { background: #001c64; }
        button:disabled { opacity: 0.65; cursor: not-allowed; }
        button:focus-visible {
          outline: 3px solid #0070e0;
          outline-offset: 4px;
        }
      `,
      onMount(container) {
        container.append(button);
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
          redactedNotes = redactSellerNote(result.text);
          button.disabled = redactedNotes.trim().length === 0;
          button.textContent = button.disabled
            ? 'Unavailable'
            : 'Check invoice';
          break;
        }
        case 'empty':
          console.log('[Pay Guardian] Seller note is empty');
          break;
        case 'missing':
          console.warn(
            '[Pay Guardian] Seller note not found within 10 seconds',
          );
          break;
        case 'ambiguous':
          console.warn(
            '[Pay Guardian] Multiple seller notes found; extraction stopped',
          );
          break;
      }
    });
    ctx.onInvalidated(stop); // Clean up when WXT unloads or replaces this script.
  },
});
