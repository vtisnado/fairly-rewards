import { supabase, type FairlyEvent } from './realtime';
import type { ProgramView } from './types';
import { formatMoney } from './format';

export interface HistoryEntry {
  id: number;
  kind: 'purchase' | 'redeem' | 'perk' | 'sale';
  title: string;
  detail: string;
  amount: string | null;
  credit: boolean;
}

const HISTORY_EVENTS = ['purchase', 'redeem', 'perk_claimed', 'sale'];
const HISTORY_LIMIT = 20;

function whenLabel(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (date.toDateString() === new Date().toDateString()) return `Today ${time}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

function toEntry(event: FairlyEvent, program: ProgramView | undefined): HistoryEntry {
  const data = event.data as Record<string, string | number | null | undefined>;
  const place = program?.locations.find((location) => location.id === data.location_id)?.name;
  const when = whenLabel(event.created_at);
  switch (event.event) {
    case 'purchase':
      return {
        id: event.id,
        kind: 'purchase',
        title: `Purchase $${(Number(data.amount_cents ?? 0) / 100).toFixed(2)}`,
        detail: place ? `${place} · ${when}` : when,
        amount: String(data.credited ?? data.cashback ?? '0'),
        credit: true,
      };
    case 'redeem':
      return { id: event.id, kind: 'redeem', title: 'Used on order', detail: when, amount: String(data.amount ?? '0'), credit: false };
    case 'perk_claimed':
      return { id: event.id, kind: 'perk', title: String(data.perk ?? 'Perk claimed'), detail: when, amount: null, credit: false };
    default:
      return { id: event.id, kind: 'sale', title: 'Card sold', detail: when, amount: String(data.price ?? '0'), credit: true };
  }
}

export async function loadHistory(tokenId: string, program: ProgramView | undefined): Promise<HistoryEntry[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('token_id', tokenId)
    .in('event', HISTORY_EVENTS)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  return ((data ?? []) as FairlyEvent[]).map((event) => toEntry(event, program));
}

export const formatHistoryAmount = (entry: HistoryEntry) =>
  entry.amount === null ? '' : `${entry.credit ? '+' : '-'}${formatMoney(entry.amount)}`;
