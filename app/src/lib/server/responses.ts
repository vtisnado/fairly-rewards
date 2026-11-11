export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const failure = (code: string, status = 400) => json({ error: code }, status);

export function contractErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const known = message.match(/\b([A-Z]+(?:_[A-Z]+)+)\b/);
  return known?.[1] ?? 'CHAIN_ERROR';
}
