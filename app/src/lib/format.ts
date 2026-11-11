export const TUSDC_DECIMALS = 6;
const UNITS_PER_DOLLAR = 10n ** BigInt(TUSDC_DECIMALS);

export function baseUnitsToDollars(amount: string | bigint): number {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  return Number(value) / Number(UNITS_PER_DOLLAR);
}

export function dollarsToBaseUnits(dollars: number): string {
  return BigInt(Math.round(dollars * Number(UNITS_PER_DOLLAR))).toString();
}

export function formatMoney(amount: string | bigint): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(baseUnitsToDollars(amount));
}

export function formatPercent(bps: number): string {
  return `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export function readableTextColor(hex: string): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.4 ? '#17161A' : '#FFFFFF';
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function formatCardCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function cardCodeOf(tokenId: string): string {
  return formatCardCode(tokenId.split(':')[1] ?? '');
}

export function redemptionDisplayCode(contractCode: string): string {
  const [tokenId, sequence] = contractCode.split('#');
  return `${formatCardCode(tokenId.split(':')[1] ?? '')}-${sequence}`;
}

export function compactCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export const BALANCE_CODE_PATTERN = /^[0-9A-Z]{6}\d+$/;
