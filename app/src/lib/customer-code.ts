export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 180;
export const QR_PREFIX = 'fairly:c:';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;
const CROCKFORD_LOOKALIKES: Record<string, string> = { O: '0', I: '1', L: '1' };

export function normalizeCustomerCode(raw: string): string | null {
  const decoded = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[OIL]/g, (char) => CROCKFORD_LOOKALIKES[char]!);
  const valid = decoded.length === CODE_LENGTH && [...decoded].every((char) => CODE_ALPHABET.includes(char));
  return valid ? decoded : null;
}

export const formatCustomerCode = (code: string) => (code.length === CODE_LENGTH ? `${code.slice(0, 3)}-${code.slice(3)}` : code);

export const customerQrPayload = (token: string) => `${QR_PREFIX}${token}`;

export function parseCustomerQr(raw: string): string | null {
  const value = raw.trim();
  if (!value.startsWith(QR_PREFIX)) return null;
  const token = value.slice(QR_PREFIX.length);
  return TOKEN_PATTERN.test(token) ? token : null;
}

export const isCustomerToken = (value: string) => TOKEN_PATTERN.test(value);
