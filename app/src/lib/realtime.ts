import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from 'astro:env/client';

export type ConnectionState = 'connecting' | 'live' | 'offline';

export interface FairlyEvent {
  id: number;
  event: string;
  program_slug: string | null;
  token_id: string | null;
  account_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

export interface EventSubscription {
  column: 'token_id' | 'account_id' | 'program_slug';
  value: string;
  onEvent: (event: FairlyEvent) => void;
  onState: (state: ConnectionState) => void;
}

export function subscribeToEvents({ column, value, onEvent, onState }: EventSubscription): () => void {
  onState('connecting');
  const channel: RealtimeChannel = supabase
    .channel(`events:${column}:${value}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events', filter: `${column}=eq.${value}` },
      (payload) => onEvent(payload.new as FairlyEvent),
    )
    .subscribe((status) => {
      onState(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'offline' : 'connecting');
    });
  return () => {
    supabase.removeChannel(channel);
  };
}
