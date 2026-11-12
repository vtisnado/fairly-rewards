import { businessTypeOf } from './business-types';
import { escapeXml, formatMoney, readableTextColor } from './format';
import { ICONS } from './icons';

export interface CardArtInput {
  programName: string;
  mcc?: number;
  brandColor: string;
  tierName: string;
  tierIndex: number;
  stampsToNextTier: number;
  stampsFilled?: number;
  balance?: string;
  number?: string;
}

interface TierFinish {
  stops: string[];
  premium: boolean;
}

const INK = '#17161A';
const FONT = 'font-family="Outfit, Arial, sans-serif"';
const CHECK_PATH = 'M7 12.5l3.2 3.2L17 9';

const TIER_FINISHES: TierFinish[] = [
  { stops: ['#F6B184', '#E8894F', '#B9622E'], premium: false },
  { stops: ['#F1F4F8', '#C3CCD6', '#8E9AA8'], premium: false },
  { stops: ['#FFE9A3', '#F5C542', '#C98F12', '#FFD873'], premium: true },
  { stops: ['#ECE9FF', '#C9C1FF', '#9C90E8'], premium: true },
  { stops: ['#E4FAF0', '#8FE0BF', '#4FB98F'], premium: true },
];

function gradientStops(stops: string[]): string {
  return stops
    .map((color, index) => `<stop offset="${index / (stops.length - 1)}" stop-color="${color}"/>`)
    .join('');
}

function stamps(count: number, filled: number, ink: string, brand: string): string {
  return Array.from({ length: count }, (_, index) => {
    const cx = 64 + index * 52;
    if (index < filled) {
      return `<circle cx="${cx}" cy="334" r="20" fill="${ink}"/><path transform="translate(${cx - 12} 322)" d="${CHECK_PATH}" fill="none" stroke="${brand}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return `<circle cx="${cx}" cy="334" r="19" fill="none" stroke="${ink}" stroke-opacity=".38" stroke-width="3" stroke-dasharray="5 5"/>`;
  }).join('');
}

function premiumField(): string {
  return `<path d="M430 0H640V400H300Z" fill="url(#finish)"/>
    <path d="M430 0L300 400" stroke="${INK}" stroke-opacity=".18" stroke-width="3"/>
    <path d="M470 0L340 400" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
}

function shine(): string {
  return `<g filter="url(#soft)" style="mix-blend-mode:soft-light">
      <rect x="-420" y="-60" width="360" height="520" fill="url(#shine)" transform="skewX(-18)">
        <animate attributeName="x" values="-420;-420;1000" keyTimes="0;0.55;1" dur="6s" repeatCount="indefinite"/>
      </rect>
    </g>`;
}

function tierTab(tier: string, premium: boolean): string {
  const width = 72 + tier.length * 14;
  const x = 640 - width;
  const fill = premium ? INK : 'url(#finish)';
  const text = premium ? 'url(#finish)' : INK;
  return `<path d="M${x + 14} 304H640V352H${x + 14}A14 14 0 0 1 ${x} 338V318A14 14 0 0 1 ${x + 14} 304Z" fill="${fill}" filter="url(#lift)"/>
    <text x="${x + 24}" y="336" ${FONT} font-size="21" font-weight="800" letter-spacing="1.5" fill="${text}">${tier.toUpperCase()}</text>`;
}

export function renderCardArt(input: CardArtInput): string {
  const { programName, brandColor, tierName, tierIndex, stampsToNextTier } = input;
  const finish = TIER_FINISHES[tierIndex % TIER_FINISHES.length];
  const ink = readableTextColor(brandColor);
  const sideInk = finish.premium ? INK : ink;
  const mark = ICONS[businessTypeOf(input.mcc ?? 0).icon];
  const name = escapeXml(programName);
  const tier = escapeXml(tierName);
  const hasBalance = input.balance !== undefined;
  const number = input.number
    ? `<text x="600" y="92" text-anchor="end" ${FONT} font-size="24" font-weight="600" letter-spacing="1" fill="${sideInk}" fill-opacity=".8">No. ${escapeXml(input.number)}</text>`
    : '';
  const balanceLabel = hasBalance
    ? `<text x="48" y="218" ${FONT} font-size="20" font-weight="500" fill="${ink}" fill-opacity=".7">Balance</text>`
    : '';
  const balanceText = hasBalance ? formatMoney(input.balance ?? '0') : 'Rewards card';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="img" aria-label="${name} ${tier} card">
  <defs>
    <clipPath id="card"><rect width="640" height="400" rx="32"/></clipPath>
    <linearGradient id="finish" x1="0" y1="0" x2="1" y2="1">${gradientStops(finish.stops)}</linearGradient>
    <linearGradient id="shine" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".9"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="lift" x="-20%" y="-30%" width="140%" height="180%"><feDropShadow dx="-2" dy="3" stdDeviation="4" flood-color="${INK}" flood-opacity=".3"/></filter>
  </defs>
  <g clip-path="url(#card)">
    <rect width="640" height="400" fill="${brandColor}"/>
    ${finish.premium ? premiumField() : ''}
    <circle cx="560" cy="40" r="168" fill="none" stroke="${sideInk}" stroke-opacity=".15" stroke-width="4" stroke-dasharray="10 12"/>
    <g color="${sideInk}" opacity=".1" transform="rotate(-12 548 190) translate(468 110) scale(6.6)">${mark}</g>
    <circle cx="82" cy="82" r="34" fill="${ink}"/>
    <g color="${brandColor}" transform="translate(64 64) scale(1.5)">${mark}</g>
    <text x="132" y="93" ${FONT} font-size="30" font-weight="600" fill="${ink}">${name}</text>
    ${number}
    ${balanceLabel}
    <text x="46" y="${hasBalance ? 276 : 258}" ${FONT} font-size="${hasBalance ? 64 : 44}" font-weight="800" letter-spacing="-1" fill="${ink}">${escapeXml(balanceText)}</text>
    ${stamps(stampsToNextTier, input.stampsFilled ?? 0, ink, brandColor)}
    ${tierTab(tier, finish.premium)}
    ${finish.premium ? shine() : ''}
  </g>
</svg>`;
}
