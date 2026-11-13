import type { APIRoute } from 'astro';
import { SLUG_PATTERN, buildManifest, type ShortcutKind } from '../../../lib/manifest';
import { getProgram } from '../../../lib/near';
import { manifestResponse } from '../../../lib/server/manifest-response';

const KINDS = new Set<string>(['counter', 'dashboard']);

export const GET: APIRoute = async ({ params }) => {
  const { kind = '', slug = '' } = params;
  if (!KINDS.has(kind) || !SLUG_PATTERN.test(slug)) return new Response('Not found', { status: 404 });
  const program = await getProgram(slug).catch(() => null);
  if (!program) return new Response('Not found', { status: 404 });
  return manifestResponse(buildManifest(kind as ShortcutKind, program.slug, program.name));
};
