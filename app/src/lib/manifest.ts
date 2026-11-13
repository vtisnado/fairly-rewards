export type ShortcutKind = 'wallet' | 'counter' | 'dashboard' | 'market';

export const SLUG_PATTERN = /^[a-z0-9-]{3,32}$/;
export const SHORT_NAME_LIMIT = 12;

const DARK = '#17161A';
const CREAM = '#FFF6EC';
const BACKOFFICE = '#F4F4F2';

export interface WebManifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: 'standalone';
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
}

const ICONS: WebManifest['icons'] = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export const shortName = (name: string) => {
  const trimmed = name.trim();
  return trimmed.length <= SHORT_NAME_LIMIT ? trimmed : `${trimmed.slice(0, SHORT_NAME_LIMIT - 1).trimEnd()}…`;
};

export const manifestUrl = (kind: ShortcutKind, slug?: string) =>
  kind === 'market' || kind === 'wallet' ? `/manifest/${kind}.webmanifest` : `/manifest/${kind}/${slug}.webmanifest`;

export const startUrl = (kind: ShortcutKind, slug = '') =>
  ({ wallet: '/wallet', counter: `/cashier/${slug}`, dashboard: `/business/${slug}`, market: '/market' })[kind];

const SCOPES: Record<ShortcutKind, string> = { wallet: '/wallet', counter: '/cashier/', dashboard: '/business/', market: '/market' };
const SURFACES: Record<ShortcutKind, string> = { wallet: CREAM, counter: DARK, dashboard: BACKOFFICE, market: CREAM };

function names(kind: ShortcutKind, business: string) {
  switch (kind) {
    case 'wallet':
      return { name: 'Fairly', short_name: 'Fairly', description: 'Every loyalty card you own, with the money inside.' };
    case 'counter':
      return { name: `${business} Counter`, short_name: shortName(`${business} Counter`), description: `Scan cards and add cashback at the ${business} counter.` };
    case 'dashboard':
      return { name: `${business} Dashboard`, short_name: shortName(`${business} Dashboard`), description: `Sales, cashback and members for ${business}.` };
    case 'market':
      return { name: 'Fairly Market', short_name: 'Market', description: 'Loyalty cards with money already inside, for sale.' };
  }
}

export function buildManifest(kind: ShortcutKind, slug = '', businessName = ''): WebManifest {
  const start = startUrl(kind, slug);
  return {
    id: start,
    ...names(kind, businessName.trim()),
    start_url: start,
    scope: SCOPES[kind],
    display: 'standalone',
    background_color: SURFACES[kind],
    theme_color: DARK,
    icons: ICONS,
  };
}
