import { clientKey, isRateLimited } from './rate-limit';
import { failure } from './responses';
import { demoProgramSlug } from './signers';

export function rejectUnlessDemo(request: Request, slug: string | undefined, scope: string, limit: number): Response | null {
  if (isRateLimited(clientKey(request, scope), limit, 60 * 60 * 1000)) {
    return failure('RATE_LIMITED', 429);
  }
  if (slug !== demoProgramSlug) {
    return failure('NOT_DEMO_PROGRAM', 403);
  }
  return null;
}
