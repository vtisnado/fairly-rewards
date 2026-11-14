export function nearAmount(value: string): `${number}` {
  if (value.trim() === '' || !Number.isFinite(Number(value))) throw new Error('INVALID_AMOUNT');
  return value as `${number}`;
}
