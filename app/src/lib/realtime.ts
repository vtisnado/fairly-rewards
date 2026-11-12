import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from 'astro:env/client';

export type ConnectionState = 'connecting' | 'live' | 'offline';

export interface FairlyEvent {
  id: number;
  event: string;
  program_slug: string | null;
  token_id: string | null;
  account_id: string | null;
  signer_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface HonoredCodeRow {
  code: string;
  program_slug: string;
  token_id: string;
  kind: 'redeem' | 'perk';
  amount: string | null;
  perk: string | null;
  honored_at: string;
}

type Table = 'events' | 'honored_codes';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

export interface Subscription<T> {
  table?: Table;
  column: string;
  value: string;
  onInsert: (row: T) => void;
  onState: (state: ConnectionState) => void;
}

export function subscribeToInserts<T>({ table = 'events', column, value, onInsert, onState }: Subscription<T>): () => void {
  onState('connecting');
  const channel: RealtimeChannel = supabase
    .channel(`${table}:${column}:${value}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `${column}=eq.${value}` }, (payload) =>
      onInsert(payload.new as T),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onState('offline');
      else onState('connecting');
    });
  return () => {
    supabase.removeChannel(channel);
  };
}

export const subscribeToEvents = ({
  column,
  value,
  onEvent,
  onState,
}: {
  column: 'token_id' | 'account_id' | 'program_slug';
  value: string;
  onEvent: (event: FairlyEvent) => void;
  onState: (state: ConnectionState) => void;
}) => subscribeToInserts<FairlyEvent>({ column, value, onInsert: onEvent, onState });

export async function recentEvents(slug: string, events: string[], sinceMinutes: number): Promise<FairlyEvent[]> {
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('program_slug', slug)
    .in('event', events)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as FairlyEvent[];
}

export async function honoredCodes(slug: string, codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const { data } = await supabase.from('honored_codes').select('code').eq('program_slug', slug).in('code', codes);
  return new Set((data ?? []).map((row) => row.code as string));
}

export async function programEvents(slug: string): Promise<FairlyEvent[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('program_slug', slug)
    .order('created_at', { ascending: true })
    .limit(5000);
  return (data ?? []) as FairlyEvent[];
}
