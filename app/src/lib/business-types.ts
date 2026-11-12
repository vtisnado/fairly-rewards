import type { IconName } from './icons';

export interface BusinessType {
  name: string;
  icon: IconName;
  mcc: number;
}

export const BUSINESS_TYPES: BusinessType[] = [
  { name: 'Coffee', icon: 'cup', mcc: 5814 },
  { name: 'Restaurant', icon: 'burger', mcc: 5812 },
  { name: 'Bakery', icon: 'cookie', mcc: 5462 },
  { name: 'Barber', icon: 'scissors', mcc: 7230 },
  { name: 'Gym', icon: 'bolt', mcc: 7997 },
  { name: 'Retail', icon: 'bag', mcc: 5999 },
  { name: 'Books', icon: 'book', mcc: 5942 },
];

export const businessTypeOf = (mcc: number) => BUSINESS_TYPES.find((type) => type.mcc === mcc) ?? BUSINESS_TYPES[0]!;

export const BRAND_PRESETS: [string, string][] = [
  ['Terracotta', '#E4572E'],
  ['Espresso', '#3B2A22'],
  ['Forest', '#2F5D4E'],
  ['Midnight', '#1F2A44'],
  ['Saffron', '#E3A72F'],
  ['Plum', '#6E3B5C'],
  ['Sage', '#8FA98B'],
  ['Ocean', '#2C6E8F'],
];

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
