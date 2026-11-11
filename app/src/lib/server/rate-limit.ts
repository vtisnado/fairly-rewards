interface Window {
  count: number;
  resetsAt: number;
}

const windows = new Map<string, Window>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

export function clientKey(request: Request, scope: string): string {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'local';
  return `${scope}:${ip}`;
}
