import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? url).origin;
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /cashier/', 'Disallow: /business/', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
