import { watchSellerNote } from '../utils/seller-note';
import { redactSellerNote } from '../utils/redact-note';
import { validateAnalysisPayload } from '../utils/analysis-payload';
import { noteReplySchema } from '../utils/note-message';

export default defineContentScript({
  matches: ['https://www.sandbox.paypal.com/invoice/p/*'],
  main(ctx) {
    console.log('[Pay Guardian] Invoice page detected');
    const stop = watchSellerNote((result) => {
      // Log status only: seller notes can contain personal information.
      switch (result.status) {
        case 'ready': {
          const redactedNotes = redactSellerNote(result.text);

          const payload = {
            version: 1,
            sellerNote: redactedNotes,
          };
          const validation = validateAnalysisPayload(payload);

          if (!validation.success) {
            // Validation errors may contain input details: log a fixed message.
            console.warn('[Pay Guardian] Invalid analysis payload; stopped');
            break;
          }
          void browser.runtime
            .sendMessage({
              //sends message to the background.ts file
              type: 'SEND_NOTE',
              payload: validation.data,
            })
            .then((reply: unknown) => {
              const response = noteReplySchema.safeParse(reply);
              if (!response.success || !response.data.ok) {
                console.warn(
                  '[Pay Guardian] Could not deliver the seller note',
                );
                return;
              }
              console.log(
                '[Pay Guardian] Backend acknowledged receipt; not analysed yet',
              );
            })
            .catch(() => {
              console.warn(
                '[Pay Guardian] Could not contact the background script',
              );
            });
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
