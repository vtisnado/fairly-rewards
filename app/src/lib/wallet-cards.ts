import type { PassView, ProgramView } from './types';
import { formatCardCode } from './format';

export type SortKey = 'recent' | 'nearest' | 'balance' | 'oldest';

export const SORT_OPTIONS: [SortKey, string][] = [
  ['recent', 'Recent'],
  ['nearest', 'Nearest'],
  ['balance', 'Highest balance'],
  ['oldest', 'Oldest'],
];

export const TIER_COLORS = ['#E8894F', '#AEB9C6', '#FFC23D', '#C9C1FF', '#8FE0BF'];

export const CARD_ASPECT = 1.6;

export interface Position {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(from: Position, to: Position): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(rad(to.lat - from.lat) / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function nearestDistance(program: ProgramView | undefined, position: Position | null): number {
  if (!program || !position || program.locations.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...program.locations.map((location) => distanceMeters(position, location)));
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function sortPasses(
  passes: PassView[],
  sort: SortKey,
  programs: Record<string, ProgramView>,
  position: Position | null,
): PassView[] {
  const compare: Record<SortKey, (a: PassView, b: PassView) => number> = {
    recent: (a, b) => b.last_activity_ns - a.last_activity_ns,
    oldest: (a, b) => a.created_ns - b.created_ns,
    balance: (a, b) => Number(BigInt(b.balance) - BigInt(a.balance)),
    nearest: (a, b) => {
      const gap = nearestDistance(programs[a.program_slug], position) - nearestDistance(programs[b.program_slug], position);
      return Number.isNaN(gap) || gap === 0 ? b.last_activity_ns - a.last_activity_ns : gap;
    },
  };
  return [...passes].sort(compare[sort]);
}

export const cardNumberOf = (pass: PassView) => formatCardCode(pass.token_id.split(':')[1] ?? '');

export function cardArtUrl(pass: PassView): string {
  const query = new URLSearchParams({
    balance: pass.balance,
    purchases: String(pass.purchase_count),
    number: cardNumberOf(pass),
  });
  return `/api/art/${pass.program_slug}/${pass.tier_index}.svg?${query}`;
}

export const totalBalance = (passes: PassView[]) => passes.reduce((sum, pass) => sum + BigInt(pass.balance), 0n);
