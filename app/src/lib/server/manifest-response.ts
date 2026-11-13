import type { WebManifest } from '../manifest';

export const manifestResponse = (manifest: WebManifest) =>
  new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
