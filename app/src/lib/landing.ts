import { renderCardArt, type CardArtInput } from './card-art';
import type { IconName } from './icons';

const ART_IDS = ['card', 'finish', 'shine', 'soft', 'lift'];

export function uniqueCardArt(prefix: string, input: CardArtInput): string {
  return ART_IDS.reduce(
    (svg, id) => svg.replaceAll(`id="${id}"`, `id="${prefix}-${id}"`).replaceAll(`url(#${id})`, `url(#${prefix}-${id})`),
    renderCardArt(input),
  );
}

export const LANDING_CARD = {
  programName: 'Cafe Esquina',
  mcc: 5814,
  brandColor: '#F2654F',
};

export const MARQUEE_ITEMS: { label: string; icon: IconName }[] = [
  { label: 'Coffee shops', icon: 'cup' },
  { label: 'Barbers', icon: 'scissors' },
  { label: 'Gyms', icon: 'bolt' },
  { label: 'Bakeries', icon: 'cookie' },
  { label: 'Bookstores', icon: 'book' },
  { label: 'Boutiques', icon: 'bag' },
  { label: 'Burger joints', icon: 'burger' },
  { label: 'Restaurants', icon: 'utensils' },
];

export const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#who', label: 'Who uses it' },
  { href: '#business', label: 'For businesses' },
  { href: '#near', label: 'Under the hood' },
  { href: '/market', label: 'Market' },
];

export const NEAR_FEATURES: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: 'wallet', color: '#FFD84D', title: 'Value lives in the card', text: 'Each card is an NFT (NEP-171) that holds its own tUSDC test stablecoin balance.' },
  { icon: 'users', color: '#8FE0BF', title: 'Gasless for customers', text: 'A sponsor pays network fees through NEP-366 meta transactions. Customers never need NEAR.' },
  { icon: 'tablet', color: '#C9C1FF', title: 'Keys that stay put', text: 'Keys are created in the browser as non-extractable keys. Recover with email through NEAR Auth or a backup file.' },
  { icon: 'tag', color: '#F2654F', title: 'Royalties by contract', text: 'Every resale on the market pays the shop its royalty automatically.' },
];

export function posterCells(): { x: number; y: number }[] {
  const size = 21;
  const cells: { x: number; y: number }[] = [];
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
  let seed = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (!inFinder(x, y) && seed % 100 < 48) cells.push({ x, y });
    }
  }
  return cells;
}
