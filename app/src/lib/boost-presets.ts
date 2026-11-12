import type { BoostInput } from './merchant-actions';
import { DAY_NS, localMidnightNs } from './timezone';

export interface BoostPreset {
  name: string;
  hint: string;
  build(offsetMinutes: number): BoostInput;
}

const nextYearFor = (month: number, day: number) => {
  const today = new Date();
  const candidate = new Date(today.getFullYear(), month, day);
  return candidate.getTime() < today.getTime() - DAY_NS / 1_000_000 ? today.getFullYear() + 1 : today.getFullYear();
};

function nthWeekday(year: number, month: number, weekday: number, nth: number): number {
  const first = new Date(year, month, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
}

function range(name: string, extra: number, month: number, day: number, days: number, offset: number): BoostInput {
  const year = nextYearFor(month, day + days - 1);
  const starts = localMidnightNs(year, month, day, offset);
  return { name, extra_bps: extra * 100, schedule: { kind: 'range', starts_ns: starts, ends_ns: starts + days * DAY_NS } };
}

export const BOOST_PRESETS: BoostPreset[] = [
  {
    name: 'Black Friday',
    hint: 'Friday after Thanksgiving to Cyber Monday · +5%',
    build: (offset) => {
      const year = nextYearFor(10, 28);
      return range('Black Friday', 5, 10, nthWeekday(year, 10, 4, 4) + 1, 4, offset);
    },
  },
  { name: 'Christmas week', hint: 'Dec 20 to Dec 26 · +3%', build: (offset) => range('Christmas week', 3, 11, 20, 7, offset) },
  { name: 'New Year', hint: 'Dec 31 to Jan 1 · +3%', build: (offset) => range('New Year', 3, 11, 31, 2, offset) },
  { name: "Valentine's week", hint: 'Feb 8 to Feb 14 · +3%', build: (offset) => range("Valentine's week", 3, 1, 8, 7, offset) },
  {
    name: "Mother's Day",
    hint: 'Second Sunday of May and the 2 days before · +4%',
    build: (offset) => {
      const year = nextYearFor(4, 14);
      return range("Mother's Day", 4, 4, nthWeekday(year, 4, 0, 2) - 2, 3, offset);
    },
  },
  { name: 'Back to school', hint: 'Sep 1 to Sep 7 · +2%', build: (offset) => range('Back to school', 2, 8, 1, 7, offset) },
  {
    name: 'Slow Mondays',
    hint: 'Every Monday · +2%',
    build: () => ({ name: 'Slow Mondays', extra_bps: 200, schedule: { kind: 'weekly', weekday: 1 } }),
  },
];
