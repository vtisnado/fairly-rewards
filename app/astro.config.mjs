import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

const secret = () => envField.string({ context: 'server', access: 'secret' });

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [vue()],
  devToolbar: { enabled: false },
  env: {
    schema: {
      SPONSOR_ACCOUNT_ID: secret(),
      SPONSOR_PRIVATE_KEY: secret(),
      SPONSOR_AMOUNT_NEAR: envField.string({ context: 'server', access: 'public', default: '0.05' }),
      MERCHANT_START_NEAR: envField.string({ context: 'server', access: 'public', default: '0.5' }),
      DEMO_MERCHANT_ACCOUNT_ID: secret(),
      DEMO_MERCHANT_PRIVATE_KEY: secret(),
      DEMO_CASHIER_ACCOUNT_ID: secret(),
      DEMO_CASHIER_PRIVATE_KEY: secret(),
      SUPABASE_URL: envField.string({ context: 'server', access: 'public' }),
      SUPABASE_SECRET_KEY: secret(),
      PUBLIC_SUPABASE_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_DEMO_PROGRAM_SLUG: envField.string({ context: 'client', access: 'public', default: 'cafe-esquina' }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    envDir: '..',
  },
});
