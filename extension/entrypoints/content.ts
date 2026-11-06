import { watchSellerNote } from '../utils/seller-note';

export default defineContentScript({
  matches: ['https://www.sandbox.paypal.com/invoice/p/*'],
  main(ctx) {
    console.log('[Pay Guardian] Invoice page detected');
    const stop = watchSellerNote((result) => {
      // Log status only: seller notes can contain personal information.
      switch (result.status) {
        case 'ready':
          console.log(
            '[Pay Guardian] Seller note found; ready for local redaction',
          );
          break;
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
    ctx.onInvalidated(stop); //calls the stop function when there is no valid data.
  },
});
