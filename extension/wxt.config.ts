import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  manifest: {
    name: 'Pay Guardian',
    description: 'Checks PayPal invoices for social engineering warning signs.',
    version: '0.1.0',
    // Allow the background script to reach the local and deployed APIs.
    host_permissions: [
      'http://localhost/*',
      'https://pay-guardian-oiwh.vercel.app/*',
    ],
  },
});
