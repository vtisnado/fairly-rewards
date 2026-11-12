<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import LocationPicker from '../ui/LocationPicker.vue';
import MapView from '../ui/MapView.vue';
import SelectMenu from '../ui/SelectMenu.vue';
import BoostForm from './BoostForm.vue';
import { BRAND_PRESETS, BUSINESS_TYPES, businessTypeOf, slugify } from '../../lib/business-types';
import { renderCardArt } from '../../lib/card-art';
import { dollarsToBaseUnits, formatMoney, formatPercent, readableTextColor } from '../../lib/format';
import { shortAddress, type Place } from '../../lib/geocoding';
import {
  PROGRAM_DEPOSIT_NEAR,
  actionError,
  createProgram,
  ensureMerchant,
  fundPool,
  ownerActions,
  type BoostInput,
  type LocationInput,
  type MerchantActions,
} from '../../lib/merchant-actions';
import { BOOST_PRESETS } from '../../lib/boost-presets';
import { getProgram } from '../../lib/near';
import { browserTimeZone, offsetLabel, offsetOf, timeZoneOptions } from '../../lib/timezone';
import type { ProgramView } from '../../lib/types';

const props = defineProps<{ program?: ProgramView; actions?: MerchantActions }>();
const emit = defineEmits<{ launched: [slug: string]; saved: []; notice: [text: string] }>();

const editing = computed(() => !!props.program);
const STEPS = editing.value ? ['Brand', 'Rewards'] : ['Brand', 'Rewards', 'Boosts', 'Locations', 'Fund'];
const TIER_NAMES = ['Bronze', 'Silver', 'Gold'];
const TIER_COLORS = ['#E8894F', '#AEB9C6', '#FFC23D'];
const EXPIRY_OPTIONS = [
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
  { value: 0, label: 'Never' },
];
const FUND_OPTIONS = [50, 100, 250];
const MAX_FUND = 1000;

const step = ref(1);
const name = ref(props.program?.name ?? '');
const slug = ref(props.program?.slug ?? '');
const slugTouched = ref(editing.value);
const slugState = ref<'idle' | 'checking' | 'free' | 'taken'>('idle');
const mcc = ref(props.program?.mcc ?? BUSINESS_TYPES[0]!.mcc);
const utcOffset = ref(props.program?.utc_offset_minutes ?? offsetOf(browserTimeZone()));
const zoneOptions = timeZoneOptions();
const color = ref(props.program?.brand_color ?? BRAND_PRESETS[0]![1]);
const logoUrl = ref(props.program?.logo_url ?? '');
const cashback = ref((props.program?.cashback_bps ?? 500) / 100);
const royalty = ref((props.program?.royalty_bps ?? 500) / 100);
const expiry = ref(props.program ? props.program.expiry_days ?? 0 : 90);
const dailyCap = ref(props.program ? Number(props.program.daily_cap) / 1_000_000 : 30);
const tiers = ref(
  props.program?.tiers.map((tier) => ({ ...tier, perk: tier.perk ?? '' })) ??
    TIER_NAMES.map((tierName, index) => ({ name: tierName, min_purchases: [0, 3, 6][index]!, perk: ['', 'Free pastry', 'Free coffee every month'][index]! })),
);
const boosts = ref<BoostInput[]>([]);
const boostFormOpen = ref(false);
const locations = ref<LocationInput[]>([]);
const newLocationName = ref('');
const newPlace = ref<Place | null>(null);
const fund = ref(100);
const customFund = ref<number | null>(null);
const working = ref(false);
const progress = ref<string[]>([]);
const error = ref('');

const brandInk = computed(() => readableTextColor(color.value));
const validColor = computed(() => /^#[0-9a-fA-F]{6}$/.test(color.value));
const fundDollars = computed(() => customFund.value || fund.value);
const presetName = computed(() => BRAND_PRESETS.find(([, hex]) => hex.toLowerCase() === color.value.toLowerCase())?.[0] ?? 'Custom');
const tiersValid = computed(() => tiers.value.every((tier, index) => index === 0 || tier.min_purchases > tiers.value[index - 1]!.min_purchases));
const preview = computed(() =>
  renderCardArt({
    programName: name.value || 'Your business',
    mcc: mcc.value,
    brandColor: validColor.value ? color.value : '#E4572E',
    tierName: tiers.value[0]?.name ?? 'Bronze',
    tierIndex: 0,
    stampsToNextTier: Math.min(8, tiers.value[1]?.min_purchases ?? 0),
    stampsFilled: 1,
    balance: dollarsToBaseUnits((10 * cashback.value) / 100),
  }),
);
const locationPins = computed(() => locations.value.map((location) => ({ id: location.id, label: location.name, lat: location.lat, lng: location.lng })));

const stepValid = computed(() => {
  if (step.value === 1) return name.value.trim().length > 0 && validColor.value && (editing.value || (slug.value.length >= 3 && slugState.value === 'free'));
  if (step.value === 2) return tiersValid.value && dailyCap.value > 0;
  if (step.value === 4) return locations.value.length > 0;
  if (step.value === 5) return fundDollars.value >= 10 && fundDollars.value <= MAX_FUND;
  return true;
});

let slugTimer = 0;
watch(name, (value) => {
  if (!slugTouched.value) slug.value = slugify(value);
});
watch(slug, (value) => {
  if (editing.value) return;
  clearTimeout(slugTimer);
  if (value.length < 3) {
    slugState.value = 'idle';
    return;
  }
  slugState.value = 'checking';
  slugTimer = window.setTimeout(async () => {
    const existing = await getProgram(value).catch(() => null);
    if (slug.value === value) slugState.value = existing ? 'taken' : 'free';
  }, 400);
});

function addBoost(boost: BoostInput) {
  boosts.value = [...boosts.value, boost];
  boostFormOpen.value = false;
}

function addLocation() {
  if (!newPlace.value || !newLocationName.value.trim()) return;
  const id = slugify(newLocationName.value) || `location-${locations.value.length + 1}`;
  if (locations.value.some((location) => location.id === id)) {
    error.value = 'A location with that name already exists.';
    return;
  }
  error.value = '';
  locations.value = [
    ...locations.value,
    { id, name: newLocationName.value.trim(), address: shortAddress(newPlace.value.address).slice(0, 160), lat: newPlace.value.lat, lng: newPlace.value.lng },
  ];
  newLocationName.value = '';
  newPlace.value = null;
}

const describeBoost = (boost: BoostInput) => {
  if (boost.schedule.kind === 'weekly') {
    return `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][boost.schedule.weekday]}`;
  }
  const format = (ns: number) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(ns / 1_000_000);
  return `${format(boost.schedule.starts_ns)} to ${format(boost.schedule.ends_ns - 86_400_000_000_000)}`;
};

async function launch() {
  working.value = true;
  error.value = '';
  progress.value = [];
  try {
    progress.value.push('Opening your business account');
    const wallet = await ensureMerchant();
    progress.value.push('Creating the program on chain');
    await createProgram(wallet, {
      slug: slug.value,
      name: name.value.trim(),
      mcc: mcc.value,
      utc_offset_minutes: utcOffset.value,
      brand_color: color.value.toUpperCase(),
      logo_url: logoUrl.value.trim() || null,
      cashback_bps: Math.round(cashback.value * 100),
      royalty_bps: Math.round(royalty.value * 100),
      expiry_days: expiry.value || null,
      daily_cap: dollarsToBaseUnits(dailyCap.value),
      tiers: tiers.value.map((tier) => ({ name: tier.name, min_purchases: tier.min_purchases, perk: tier.perk.trim() || null })),
      locations: locations.value,
    });
    const actions = ownerActions(wallet, slug.value);
    for (const boost of boosts.value) {
      progress.value.push(`Adding boost ${boost.name}`);
      await actions.addBoost(boost);
    }
    progress.value.push(`Adding ${formatMoney(dollarsToBaseUnits(fundDollars.value))} of test money`);
    await fundPool(wallet, slug.value, fundDollars.value);
    emit('launched', slug.value);
  } catch (cause) {
    error.value = actionError(cause);
  } finally {
    working.value = false;
  }
}

async function saveChanges() {
  if (!props.actions || !props.program) return;
  working.value = true;
  error.value = '';
  try {
    await props.actions.updateProgram({
      name: name.value.trim(),
      brand_color: color.value.toUpperCase(),
      logo_url: logoUrl.value.trim(),
      cashback_bps: Math.round(cashback.value * 100),
      perks: tiers.value.map((tier) => tier.perk.trim() || null),
      utc_offset_minutes: utcOffset.value,
    });
    emit('notice', 'Changes saved');
    emit('saved');
  } catch (cause) {
    error.value = actionError(cause);
  } finally {
    working.value = false;
  }
}

function next() {
  if (!stepValid.value) return;
  if (step.value < STEPS.length) step.value++;
  else if (editing.value) saveChanges();
  else launch();
}
</script>

<template>
  <section class="grid items-start gap-8 p-8 xl:grid-cols-[1fr_380px]">
    <div class="rounded-xl border border-bo-line bg-white">
      <div class="border-b border-bo-line px-8 pt-6">
        <h1 class="text-2xl font-bold">{{ editing ? 'Brand and rewards' : 'Set up your program' }}</h1>
        <div class="mt-5 flex gap-6 overflow-x-auto text-sm font-semibold">
          <button
            v-for="(label, index) in STEPS"
            :key="label"
            type="button"
            class="flex items-center gap-2 border-b-2 pb-3 whitespace-nowrap transition disabled:cursor-not-allowed"
            :class="step === index + 1 ? 'border-bo-text text-bo-text' : 'border-transparent text-bo-muted hover:text-bo-text'"
            :disabled="index + 1 > step && !stepValid"
            @click="index + 1 <= step || stepValid ? (step = index + 1) : null"
          >
            <span
              class="grid size-6 place-items-center rounded-full text-xs"
              :class="step > index + 1 ? '' : step === index + 1 ? 'bg-bo-text text-white' : 'bg-bo-bg'"
              :style="step > index + 1 ? { background: color, color: brandInk } : {}"
            >
              <AppIcon v-if="step > index + 1" name="check" class="size-3.5" />
              <template v-else>{{ index + 1 }}</template>
            </span>
            {{ label }}
          </button>
        </div>
      </div>

      <div class="min-h-[540px] p-8">
        <div v-if="step === 1" class="max-w-2xl space-y-6">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="block text-sm font-semibold">
              Business name
              <input v-model="name" maxlength="64" class="mt-1.5 h-11 w-full rounded-lg border border-bo-line px-3.5 font-normal focus:border-bo-text focus:outline-none" placeholder="Corner Café" />
            </label>
            <label class="block text-sm font-semibold">
              Web address
              <span class="mt-1.5 flex h-11 items-center rounded-lg border border-bo-line px-3.5 font-normal focus-within:border-bo-text" :class="editing && 'bg-bo-bg'">
                <span class="text-bo-muted">/join/</span>
                <input
                  v-model="slug"
                  maxlength="32"
                  class="min-w-0 flex-1 bg-transparent font-mono text-sm focus:outline-none"
                  :disabled="editing"
                  aria-label="Web address"
                  @input="slugTouched = true; slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')"
                />
              </span>
              <span v-if="!editing" class="mt-1 block text-xs font-normal" :class="slugState === 'taken' ? 'text-red-600' : 'text-bo-muted'">
                {{ { idle: '3 to 32 letters, numbers or dashes.', checking: 'Checking…', free: 'Available.', taken: 'Taken. Try another one.' }[slugState] }}
              </span>
            </label>
          </div>
          <div class="max-w-md text-sm font-semibold">
            Time zone
            <SelectMenu v-model="utcOffset" class="mt-1.5" :options="zoneOptions" label="Time zone" />
            <span class="mt-1 block text-xs font-normal text-bo-muted">Daily limits reset and boosts start at midnight in this time zone. Detected from this device: {{ offsetLabel(offsetOf(browserTimeZone())) }}.</span>
          </div>
          <div class="text-sm font-semibold">
            Type of business
            <div class="mt-1.5 grid grid-cols-4 gap-2 md:grid-cols-7">
              <button
                v-for="type in BUSINESS_TYPES"
                :key="type.mcc"
                type="button"
                class="flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-50"
                :class="mcc === type.mcc ? 'border-bo-text bg-bo-bg' : 'border-bo-line hover:border-bo-muted'"
                :disabled="editing"
                @click="mcc = type.mcc"
              >
                <AppIcon :name="type.icon" class="size-6" />{{ type.name }}
              </button>
            </div>
          </div>
          <div class="text-sm font-semibold">
            Brand color
            <div class="mt-1.5 flex flex-wrap items-center gap-2">
              <button
                v-for="[label, hex] in BRAND_PRESETS"
                :key="hex"
                type="button"
                class="size-9 rounded-lg ring-offset-2 transition hover:scale-105"
                :class="color.toLowerCase() === hex.toLowerCase() && 'ring-2 ring-bo-text'"
                :style="{ background: hex }"
                :title="label"
                :aria-label="label"
                @click="color = hex"
              />
              <span class="mx-1 h-8 w-px bg-bo-line" />
              <label
                class="relative size-9 cursor-pointer overflow-hidden rounded-lg ring-1 ring-bo-line transition hover:scale-105"
                title="Custom color"
                style="background: conic-gradient(#e94b3c, #f2c14e, #5cb270, #3a8dde, #8a63d2, #e94b3c)"
              >
                <input v-model="color" type="color" class="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom color" />
              </label>
              <span class="relative">
                <span class="absolute top-1/2 left-3 size-4 -translate-y-1/2 rounded" :style="{ background: validColor ? color : '#fff' }" />
                <input v-model="color" maxlength="7" class="h-9 w-32 rounded-lg border border-bo-line pr-2 pl-9 font-mono text-sm uppercase focus:border-bo-text focus:outline-none" aria-label="Color code" />
              </span>
            </div>
            <p class="mt-2 text-xs font-normal text-bo-muted">{{ validColor ? presetName : 'Use a color code like #E4572E.' }}</p>
          </div>
          <label class="block text-sm font-semibold">
            Logo link <span class="font-normal text-bo-muted">(optional)</span>
            <span class="mt-1.5 flex items-center gap-3">
              <span class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-bo-bg">
                <img v-if="logoUrl" :src="logoUrl" alt="" class="size-full object-cover" />
                <AppIcon v-else :name="businessTypeOf(mcc).icon" class="size-5 text-bo-muted" />
              </span>
              <input v-model="logoUrl" type="url" maxlength="200" class="h-11 w-full rounded-lg border border-bo-line px-3.5 font-normal focus:border-bo-text focus:outline-none" placeholder="https://example.com/logo.png" />
            </span>
            <span class="mt-1 block text-xs font-normal text-bo-muted">A square PNG or SVG. The link is stored on chain, so use a stable address.</span>
          </label>
        </div>

        <div v-else-if="step === 2" class="max-w-2xl space-y-6">
          <div class="rounded-lg border border-bo-line p-5">
            <div class="flex items-end justify-between">
              <div><p class="font-semibold">Base cashback</p><p class="text-sm text-bo-muted">Applies to every purchase. Boosts can raise it for a season.</p></div>
              <p class="font-mono text-4xl font-extrabold">{{ cashback }}%</p>
            </div>
            <input v-model.number="cashback" type="range" min="1" max="25" class="mt-4 w-full" :style="{ accentColor: color }" aria-label="Base cashback" />
            <div class="flex justify-between font-mono text-xs text-bo-muted"><span>1%</span><span>25%</span></div>
            <p class="mt-3 text-sm">A <b>$10.00</b> purchase gives <b>{{ formatMoney(dollarsToBaseUnits((10 * cashback) / 100)) }}</b> back.</p>
          </div>
          <div>
            <p class="font-semibold">Levels and perks</p>
            <table class="mt-2 w-full overflow-hidden rounded-lg border border-bo-line text-sm">
              <thead class="bg-bo-bg text-left text-bo-muted">
                <tr><th class="p-3 font-semibold">Level</th><th class="p-3 font-semibold">Visits</th><th class="p-3 font-semibold">Perk</th></tr>
              </thead>
              <tbody>
                <tr v-for="(tier, index) in tiers" :key="index" class="border-t border-bo-line">
                  <td class="p-3"><span class="inline-flex items-center gap-2 font-semibold"><span class="size-3 rounded-sm" :style="{ background: TIER_COLORS[index] }" />{{ tier.name }}</span></td>
                  <td class="w-28 p-3">
                    <input
                      v-model.number="tier.min_purchases"
                      type="number"
                      min="0"
                      class="h-9 w-full rounded-lg border border-bo-line px-2.5 font-mono focus:border-bo-text focus:outline-none disabled:bg-bo-bg"
                      :disabled="index === 0 || editing"
                      :aria-label="`${tier.name} visits`"
                    />
                  </td>
                  <td class="p-3"><input v-model="tier.perk" maxlength="80" class="h-9 w-full rounded-lg border border-bo-line px-2.5 focus:border-bo-text focus:outline-none" :aria-label="`${tier.name} perk`" placeholder="No perk" /></td>
                </tr>
              </tbody>
            </table>
            <p v-if="!tiersValid" class="mt-2 text-sm font-semibold text-red-600">Each level needs more visits than the one before.</p>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <div class="text-sm font-semibold">
              Unused balance returns after
              <SelectMenu v-model="expiry" class="mt-1.5" :options="EXPIRY_OPTIONS" label="Expiry" :class="editing && 'pointer-events-none opacity-60'" />
            </div>
            <label class="block text-sm font-semibold">
              Your share of card resales
              <span class="mt-1.5 flex h-10 items-center gap-3">
                <input v-model.number="royalty" type="range" min="0" max="15" class="flex-1" :style="{ accentColor: color }" :disabled="editing" aria-label="Resale share" />
                <span class="w-12 text-right font-mono font-bold">{{ royalty }}%</span>
              </span>
            </label>
            <label class="block text-sm font-semibold">
              Daily cashback limit per location
              <span class="mt-1.5 flex h-10 items-center rounded-lg border border-bo-line px-3 font-normal" :class="editing && 'bg-bo-bg'">
                <span class="text-bo-muted">$</span>
                <input v-model.number="dailyCap" type="number" min="1" max="10000" class="w-full bg-transparent font-mono focus:outline-none" :disabled="editing" aria-label="Daily cashback limit" />
              </span>
            </label>
          </div>
          <p v-if="editing" class="text-xs text-bo-muted">Visits per level, resale share, expiry and the daily limit are fixed once the program is live, so customers keep the terms they joined with.</p>
        </div>

        <div v-else-if="step === 3" class="max-w-2xl space-y-4">
          <p class="text-sm text-bo-muted">Raise cashback for a date range or a recurring slow day. Boosts add to the base rate (max 25%) and stop on their own. You can skip this and add them later.</p>
          <div v-for="(boost, index) in boosts" :key="index" class="flex items-center gap-4 rounded-lg border border-bo-line p-4">
            <span class="grid size-11 place-items-center rounded-lg" :style="{ background: color, color: brandInk }"><AppIcon name="calendar" class="size-5" /></span>
            <div class="flex-1"><p class="font-semibold">{{ boost.name }}</p><p class="text-sm text-bo-muted">{{ describeBoost(boost) }}</p></div>
            <span class="font-mono text-sm font-bold">+{{ formatPercent(boost.extra_bps) }}</span>
            <button type="button" class="text-bo-muted hover:text-red-600" :aria-label="`Remove ${boost.name}`" @click="boosts = boosts.filter((_, position) => position !== index)">✕</button>
          </div>
          <button type="button" class="flex h-11 items-center gap-2 rounded-lg border border-dashed border-bo-line px-4 text-sm font-semibold transition hover:border-bo-muted" @click="boostFormOpen = true">
            <AppIcon name="plus" class="size-4" />Add a boost
          </button>
          <div class="pt-2">
            <p class="text-sm font-semibold">Suggestions</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="preset in BOOST_PRESETS.filter((entry) => !boosts.some((boost) => boost.name === entry.name))"
                :key="preset.name"
                type="button"
                class="h-9 rounded-full border border-dashed border-bo-line px-3 text-sm transition hover:border-bo-muted"
                :title="preset.hint"
                @click="addBoost(preset.build(utcOffset))"
              >
                + {{ preset.name }}
              </button>
            </div>
          </div>
          <BoostForm v-if="boostFormOpen" :brand="color" :base-bps="cashback * 100" :offset-minutes="utcOffset" @submit="addBoost" @cancel="boostFormOpen = false" />
        </div>

        <div v-else-if="step === 4" class="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div class="h-[380px]"><MapView :pins="locationPins" :color="color" /></div>
          <div class="space-y-3">
            <div v-for="(location, index) in locations" :key="location.id" class="flex items-start gap-3 rounded-lg border border-bo-line p-3">
              <span class="grid size-8 place-items-center rounded-md bg-bo-bg font-mono text-sm font-bold">{{ index + 1 }}</span>
              <div class="min-w-0 flex-1"><p class="text-sm font-semibold">{{ location.name }}</p><p class="truncate text-xs text-bo-muted">{{ location.address }}</p></div>
              <button type="button" class="text-bo-muted hover:text-red-600" :aria-label="`Remove ${location.name}`" @click="locations = locations.filter((entry) => entry.id !== location.id)">✕</button>
            </div>
            <div class="rounded-lg border border-dashed border-bo-line p-3">
              <p class="text-xs font-semibold">Add a location</p>
              <input v-model="newLocationName" maxlength="64" class="mt-1.5 h-10 w-full rounded-lg border border-bo-line px-3 text-sm focus:border-bo-text focus:outline-none" placeholder="Location name, like Downtown" aria-label="Location name" />
              <LocationPicker v-model="newPlace" class="mt-2 text-sm" :color="color" :label="newLocationName" :others="locationPins" />
              <button type="button" class="mt-2 h-10 w-full rounded-lg bg-bo-text text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40" :disabled="!newPlace || !newLocationName.trim()" @click="addLocation">Add location</button>
            </div>
            <p v-if="!locations.length" class="text-xs text-bo-muted">Add at least one location to continue.</p>
          </div>
        </div>

        <div v-else class="max-w-2xl space-y-6">
          <div>
            <p class="font-semibold">Cashback pool</p>
            <p class="text-sm text-bo-muted">Cashback is paid from this balance. You can withdraw what is not used at any time.</p>
            <div class="mt-3 grid grid-cols-4 gap-2">
              <button
                v-for="amount in FUND_OPTIONS"
                :key="amount"
                type="button"
                class="h-16 rounded-lg border px-4 text-left transition"
                :class="fund === amount && !customFund ? 'border-bo-text bg-bo-bg' : 'border-bo-line hover:border-bo-muted'"
                @click="fund = amount; customFund = null"
              >
                <p class="font-mono text-xl font-bold">${{ amount }}</p>
                <p class="text-xs text-bo-muted">~{{ Math.round(amount / ((10 * cashback) / 100)) }} visits</p>
              </button>
              <label class="flex h-16 flex-col justify-center rounded-lg border px-4 transition" :class="customFund ? 'border-bo-text bg-bo-bg' : 'border-bo-line'">
                <span class="text-xs text-bo-muted">Custom</span>
                <span class="flex items-center font-mono text-xl font-bold">$<input v-model.number="customFund" type="number" min="10" :max="MAX_FUND" class="ml-0.5 w-full bg-transparent outline-none" placeholder="500" aria-label="Custom amount" /></span>
              </label>
            </div>
            <p v-if="customFund && (customFund < 10 || customFund > MAX_FUND)" class="mt-2 text-sm font-semibold text-red-600">Pick between $10 and ${{ MAX_FUND }}.</p>
          </div>
          <div>
            <p class="font-semibold">Pay with</p>
            <label class="mt-3 flex items-center gap-4 rounded-lg border border-bo-text p-4">
              <input type="radio" checked class="accent-black" aria-label="Test dollars" />
              <span class="grid size-10 place-items-center rounded-lg bg-bo-bg"><AppIcon name="wallet" class="size-5" /></span>
              <span class="flex-1"><span class="block font-semibold">Test dollars</span><span class="block text-sm text-bo-muted">Minted by the testnet faucet. No real money moves.</span></span>
              <span class="text-xs font-semibold text-bo-muted">Testnet</span>
            </label>
          </div>
          <div class="flex gap-3 rounded-lg bg-bo-bg p-4 text-sm">
            <AppIcon name="tablet" class="size-5 shrink-0" />
            <p>Counter devices can give at most <b>{{ formatMoney(dollarsToBaseUnits(dailyCap)) }} a day</b> per location and can never withdraw. Your business account gets {{ PROGRAM_DEPOSIT_NEAR }} test NEAR for on-chain storage, paid by the demo sponsor.</p>
          </div>
          <ul v-if="progress.length" class="space-y-1.5 text-sm">
            <li v-for="(line, index) in progress" :key="line" class="flex items-center gap-2">
              <AppIcon v-if="index < progress.length - 1 || !working" name="check" class="size-4 text-[#1F9D6B]" />
              <span v-else class="size-4 animate-spin rounded-full border-2 border-bo-line border-t-bo-text" />
              {{ line }}
            </li>
          </ul>
        </div>
        <p v-if="error" class="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{{ error }}</p>
      </div>

      <div class="flex items-center justify-between border-t border-bo-line px-8 py-5">
        <button type="button" class="h-11 rounded-lg border border-bo-line px-5 font-semibold transition hover:bg-bo-bg" :class="step === 1 && 'invisible'" :disabled="working" @click="step--">Back</button>
        <button type="button" class="h-11 rounded-lg px-6 font-semibold transition hover:brightness-95 disabled:opacity-40" :style="{ background: validColor ? color : '#1C1B1F', color: validColor ? brandInk : '#fff' }" :disabled="!stepValid || working" @click="next">
          <template v-if="working">{{ editing ? 'Saving…' : 'Launching…' }}</template>
          <template v-else-if="step < STEPS.length">Continue</template>
          <template v-else-if="editing">Save changes</template>
          <template v-else>Add {{ formatMoney(dollarsToBaseUnits(fundDollars)) }} and launch</template>
        </button>
      </div>
    </div>

    <aside class="space-y-4 xl:sticky xl:top-10">
      <div class="rounded-xl border border-bo-line bg-white p-6">
        <p class="text-sm font-semibold text-bo-muted">Customer card preview</p>
        <div class="mt-4 overflow-hidden rounded-2xl shadow-soft [&>svg]:h-auto [&>svg]:w-full" v-html="preview" />
        <dl class="mt-5 divide-y divide-bo-line text-sm">
          <div class="flex justify-between py-2"><dt class="text-bo-muted">Cashback</dt><dd class="font-mono font-semibold">{{ cashback }}%</dd></div>
          <div class="flex justify-between py-2"><dt class="text-bo-muted">Boosts</dt><dd class="font-semibold">{{ editing ? program?.boosts.length : boosts.length }}</dd></div>
          <div class="flex justify-between py-2"><dt class="text-bo-muted">Locations</dt><dd class="font-semibold">{{ editing ? program?.locations.length : locations.length }}</dd></div>
          <div class="flex justify-between py-2"><dt class="text-bo-muted">Resale share</dt><dd class="font-mono font-semibold">{{ royalty }}%</dd></div>
        </dl>
      </div>
    </aside>
  </section>
</template>
