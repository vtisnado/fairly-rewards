export const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  cookie: '<circle cx="12" cy="12" r="8.5" fill="currentColor"/><circle cx="9" cy="10" r="1.3" fill="#fff" opacity=".8"/><circle cx="14.5" cy="9" r="1" fill="#fff" opacity=".8"/><circle cx="13" cy="14.5" r="1.3" fill="#fff" opacity=".8"/>',
  cup: '<path d="M6 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" fill="currentColor"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 3c0 1.5 1.5 1.5 1.5 3M13 3c0 1.5 1.5 1.5 1.5 3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="2" fill="currentColor"/><rect x="3" y="7" width="18" height="4" rx="1.5" fill="currentColor"/><path d="M12 7v13" stroke="#fff" stroke-width="1.8"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" fill="currentColor"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="6" r="1.4" fill="currentColor"/><circle cx="4" cy="12" r="1.4" fill="currentColor"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" stroke="currentColor" stroke-width="2"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" fill="currentColor"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" fill="currentColor"/><circle cx="8" cy="8" r="1.6" fill="#fff"/>',
} as const;

export type IconName = keyof typeof ICONS;
