import type { APIRoute } from 'astro';
import { buildManifest } from '../../lib/manifest';
import { manifestResponse } from '../../lib/server/manifest-response';

export const GET: APIRoute = () => manifestResponse(buildManifest('wallet'));
