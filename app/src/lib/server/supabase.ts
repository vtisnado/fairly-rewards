import { SUPABASE_SECRET_KEY, SUPABASE_URL } from 'astro:env/server';

const headers = (prefer?: string) => ({
  apikey: SUPABASE_SECRET_KEY,
  'content-type': 'application/json',
  ...(prefer ? { prefer } : {}),
});

export async function insertRows(table: string, rows: unknown[], conflictTarget?: string): Promise<void> {
  const query = conflictTarget ? `?on_conflict=${conflictTarget}` : '';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: headers(conflictTarget ? 'resolution=ignore-duplicates,return=minimal' : 'return=minimal'),
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(response.status === 409 ? 'ALREADY_HONORED' : `SUPABASE_${response.status}`);
  }
}

export async function selectRows<T>(table: string, query: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!response.ok) {
    throw new Error(`SUPABASE_${response.status}`);
  }
  return (await response.json()) as T[];
}

export async function upsertRows(table: string, rows: unknown[], conflictTarget: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictTarget}`, {
    method: 'POST',
    headers: headers('resolution=merge-duplicates,return=minimal'),
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(`SUPABASE_${response.status}`);
  }
}

export async function updateRows(table: string, query: string, values: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: headers('return=minimal'),
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    throw new Error(`SUPABASE_${response.status}`);
  }
}

export async function deleteRows(table: string, query: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: headers('return=minimal'),
  });
  if (!response.ok) {
    throw new Error(`SUPABASE_${response.status}`);
  }
}

export async function tryInsertRow(table: string, row: unknown): Promise<boolean> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers('return=minimal'),
    body: JSON.stringify(row),
  });
  if (response.status === 409) return false;
  if (!response.ok) {
    throw new Error(`SUPABASE_${response.status}`);
  }
  return true;
}

export async function updateRowsReturning<T>(table: string, query: string, values: Record<string, unknown>): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: headers('return=representation'),
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    throw new Error(`SUPABASE_${response.status}`);
  }
  return (await response.json()) as T[];
}
