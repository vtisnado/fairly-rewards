import type { APIRoute } from 'astro';

export const prerender = true;

const PUBLIC_PATHS = ['/', '/market', '/business'];

export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? url).origin;
  const entries = PUBLIC_PATHS.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
