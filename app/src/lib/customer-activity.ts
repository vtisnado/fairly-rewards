export interface ActivityEntry {
  id: number;
  title: string;
  detail: string;
  amount: number;
}

const MAX_ENTRIES = 20;
const storageKey = (tokenId: string) => `fairly.activity.${tokenId}`;

export function loadActivity(tokenId: string): ActivityEntry[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(tokenId)) ?? '[]') as ActivityEntry[];
  } catch {
    return [];
  }
}

export function addActivity(tokenId: string, entry: Omit<ActivityEntry, 'id'>): ActivityEntry[] {
  const entries = [{ ...entry, id: Date.now() }, ...loadActivity(tokenId)].slice(0, MAX_ENTRIES);
  localStorage.setItem(storageKey(tokenId), JSON.stringify(entries));
  return entries;
}
