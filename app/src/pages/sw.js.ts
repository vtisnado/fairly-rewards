import type { APIRoute } from 'astro';
import { serviceWorkerSource } from '../lib/server/service-worker-source';

export const GET: APIRoute = () =>
  new Response(serviceWorkerSource, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'service-worker-allowed': '/',
    },
  });
