const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const NS_PER_MS = 1_000_000;

export function offsetOf(timeZone: string, at = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const local = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
  return Math.round((local - Math.floor(at.getTime() / MINUTE_MS) * MINUTE_MS) / MINUTE_MS / 15) * 15;
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

export function timeZoneOptions(): { value: number; label: string }[] {
  const zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['UTC'];
  const byOffset = new Map<number, string[]>();
  for (const zone of zones) {
    const offset = offsetOf(zone);
    byOffset.set(offset, [...(byOffset.get(offset) ?? []), zone.split('/').pop()!.replace(/_/g, ' ')]);
  }
  return [...byOffset.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, cities]) => ({ value, label: `${offsetLabel(value)} · ${cities.slice(0, 3).join(', ')}` }));
}

export const localMidnightNs = (year: number, month: number, day: number, offsetMinutes: number) =>
  (Date.UTC(year, month, day) - offsetMinutes * MINUTE_MS) * NS_PER_MS;

export function localDate(ns: number, offsetMinutes: number): Date {
  const shifted = new Date(ns / NS_PER_MS + offsetMinutes * MINUTE_MS);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

export const DAY_NS = DAY_MS * NS_PER_MS;
