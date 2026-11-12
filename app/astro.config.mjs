import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';

if (existsSync('../.env')) process.loadEnvFile('../.env');
const env = process.env;
const supabaseOrigin = new URL(env.PUBLIC_SUPABASE_URL ?? 'http://localhost:54321').origin;
const nearAuthOrigin = `https://${env.PUBLIC_NEAR_AUTH_DOMAIN ?? 'login.testnet.fast-auth.com'}`;
const rpcOrigin = new URL(env.PUBLIC_NEAR_RPC_URL ?? 'https://test.rpc.fastnear.com').origin;
const connectSources = [
  "'self'",
  rpcOrigin,
  supabaseOrigin,
  supabaseOrigin.replace(/^http/, 'ws'),
  'https://nominatim.openstreetmap.org',
  nearAuthOrigin,
];

const secret = () => envField.string({ context: 'server', access: 'secret' });

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [vue()],
  devToolbar: { enabled: false },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        `connect-src ${connectSources.join(' ')}`,
        "img-src 'self' data: blob: https://tile.openstreetmap.org",
        "font-src 'self' https://fonts.gstatic.com",
        `frame-src ${nearAuthOrigin}`,
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      styleDirective: {
        resources: ["'self'", 'https://fonts.googleapis.com', { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },
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
