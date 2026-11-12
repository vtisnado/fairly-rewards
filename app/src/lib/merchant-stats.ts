import type { FairlyEvent } from './realtime';

const DAY_MS = 86_400_000;

export type RangeDays = 7 | 30 | 90;

export interface Period {
  from: number;
  days: number;
}

export interface Purchase {
  id: number;
  at: number;
  tokenId: string;
  cents: number;
  cashback: number;
  pending: number;
  locationId: string;
  category: string | null;
  signerId: string | null;
}

export interface Resale {
  id: number;
  at: number;
  tokenId: string;
  price: number;
  royalty: number;
}

export interface Overview {
  salesCents: number;
  visits: number;
  cashback: number;
  royalties: number;
  activeCards: number;
  returningShare: number;
  series: { day: number; cents: number }[];
  byLocation: Map<string, number>;
  byCategory: { name: string; share: number }[];
}

const numberOf = (value: unknown) => Number(value ?? 0);
const timeOf = (event: FairlyEvent) => new Date(event.created_at).getTime();

export function purchasesOf(events: FairlyEvent[]): Purchase[] {
  return events
    .filter((event) => event.event === 'purchase' && event.token_id)
    .map((event) => ({
      id: event.id,
      at: timeOf(event),
      tokenId: event.token_id as string,
      cents: numberOf(event.data.amount_cents),
      cashback: numberOf(event.data.credited) + numberOf(event.data.pending),
      pending: numberOf(event.data.pending),
      locationId: String(event.data.location_id ?? ''),
      category: typeof event.data.category === 'string' ? event.data.category : null,
      signerId: event.signer_id,
    }))
    .sort((a, b) => a.at - b.at);
}

export function resalesOf(events: FairlyEvent[]): Resale[] {
  return events
    .filter((event) => event.event === 'sale' && event.token_id)
    .map((event) => ({
      id: event.id,
      at: timeOf(event),
      tokenId: event.token_id as string,
      price: numberOf(event.data.price),
      royalty: numberOf(event.data.royalty),
    }))
    .sort((a, b) => a.at - b.at);
}

export function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function lastDays(days: number, now = Date.now()): Period {
  return { from: startOfDay(now) - (days - 1) * DAY_MS, days };
}

export function periodBetween(from: number, to: number): Period {
  const start = startOfDay(Math.min(from, to));
  return { from: start, days: Math.round((startOfDay(Math.max(from, to)) - start) / DAY_MS) + 1 };
}

export const previousPeriod = (period: Period): Period => ({ from: period.from - period.days * DAY_MS, days: period.days });

export function overview(purchases: Purchase[], resales: Resale[], period: Period, locationId: string | null): Overview {
  const until = period.from + period.days * DAY_MS;
  const inPeriod = (time: number) => time >= period.from && time < until;
  const inRange = purchases.filter((purchase) => inPeriod(purchase.at) && (!locationId || purchase.locationId === locationId));
  const firstVisit = new Map<string, number>();
  for (const purchase of purchases) {
    if (!firstVisit.has(purchase.tokenId)) firstVisit.set(purchase.tokenId, purchase.id);
  }

  const series = Array.from({ length: period.days }, (_, index) => ({ day: period.from + index * DAY_MS, cents: 0 }));
  const byLocation = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const purchase of inRange) {
    const slot = series[Math.floor((startOfDay(purchase.at) - period.from) / DAY_MS)];
    if (slot) slot.cents += purchase.cents;
    byLocation.set(purchase.locationId, (byLocation.get(purchase.locationId) ?? 0) + purchase.cents);
    const category = purchase.category ?? 'Other';
    categories.set(category, (categories.get(category) ?? 0) + 1);
  }

  const returning = inRange.filter((purchase) => firstVisit.get(purchase.tokenId) !== purchase.id).length;
  return {
    salesCents: inRange.reduce((sum, purchase) => sum + purchase.cents, 0),
    visits: inRange.length,
    cashback: inRange.reduce((sum, purchase) => sum + purchase.cashback, 0),
    royalties: resales.filter((resale) => inPeriod(resale.at)).reduce((sum, resale) => sum + resale.royalty, 0),
    activeCards: new Set(inRange.map((purchase) => purchase.tokenId)).size,
    returningShare: inRange.length ? returning / inRange.length : 0,
    series,
    byLocation,
    byCategory: [...categories.entries()]
      .map(([name, count]) => ({ name, share: count / inRange.length }))
      .sort((a, b) => b.share - a.share),
  };
}

export function change(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

export function dailyCashback(purchases: Purchase[], now = Date.now(), days = 7): number {
  const since = now - days * DAY_MS;
  return purchases.filter((purchase) => purchase.at >= since).reduce((sum, purchase) => sum + purchase.cashback, 0) / days;
}

export type RunwayLevel = 'ok' | 'low' | 'empty';

export function runway(poolBalance: number, perDay: number): { level: RunwayLevel; days: number | null } {
  if (poolBalance <= 0) return { level: 'empty', days: 0 };
  if (perDay <= 0) return { level: 'ok', days: null };
  const days = Math.floor(poolBalance / perDay);
  return { level: days < 7 ? 'low' : 'ok', days };
}
