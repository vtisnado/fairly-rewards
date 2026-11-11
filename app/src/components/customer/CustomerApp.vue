<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import BottomSheet from '../ui/BottomSheet.vue';
import QrCode from '../ui/QrCode.vue';
import type { IconName } from '../../lib/icons';
import type { PassView, ProgramView, PurchaseResult } from '../../lib/types';
import { accountUrl, getPass, getPassesByOwner } from '../../lib/near';
import { baseUnitsToDollars, dollarsToBaseUnits, formatMoney, formatPercent } from '../../lib/format';
import { addActivity, loadActivity, type ActivityEntry } from '../../lib/customer-activity';
import { subscribeToEvents, type ConnectionState } from '../../lib/realtime';
import {
  cancelListing,
  claimPerk,
  createWallet,
  listPass,
  loadWallet,
  redeem,
  type CustomerWallet,
} from '../../lib/customer-wallet';

type Screen = 'loading' | 'join' | 'intro' | 'waiting' | 'home' | 'code';
type Sheet = 'use' | 'code' | 'sell' | 'listed' | 'levels' | 'help' | null;

const props = defineProps<{ program: ProgramView; isDemo: boolean }>();

const PERK_ICONS: IconName[] = ['cookie', 'cup', 'gift', 'star', 'star'];
const SLIDES = [
  { title: 'This is your card', text: 'It lives on this phone. It is yours.', background: 'bg-sun-soft' },
  { title: 'Show it when you pay', text: 'One scan at the counter. That is it.', background: 'bg-lilac-soft' },
  {
    title: 'Money lands on it',
    text: `${formatPercent(props.program.cashback_bps)} of every purchase. Spend it or sell the card.`,
    background: 'bg-mint-soft',
  },
];

const screen = ref<Screen>('loading');
const sheet = ref<Sheet>(null);
const slide = ref(0);
const wallet = ref<CustomerWallet | null>(null);
const pass = ref<PassView | null>(null);
const activity = ref<ActivityEntry[]>([]);
const busy = ref(false);
const error = ref('');
const bump = ref(false);
const floats = ref<{ id: number; amount: number }[]>([]);
const levelUp = ref(false);
const useAmount = ref(0);
const price = ref(4);
const lastCode = ref('');
const lastCodeLabel = ref('');
const connection = ref<ConnectionState>('connecting');
let unsubscribe: (() => void) | undefined;
let subscribedTo = '';

const tiers = computed(() => props.program.tiers);
const tierIndex = computed(() => pass.value?.tier_index ?? 0);
const currentTier = computed(() => tiers.value[tierIndex.value]);
const nextTier = computed(() => tiers.value[tierIndex.value + 1] ?? null);
const balance = computed(() => baseUnitsToDollars(pass.value?.balance ?? '0'));
const pending = computed(() => baseUnitsToDollars(pass.value?.pending ?? '0'));
const cardNumber = computed(() => formatCardCode(pass.value?.token_id.split(':')[1] ?? ''));
const royaltyShare = computed(() => props.program.royalty_bps / 10_000);
const progress = computed(() => {
  if (!nextTier.value || !pass.value) return 1;
  const span = nextTier.value.min_purchases - currentTier.value.min_purchases;
  return (pass.value.purchase_count - currentTier.value.min_purchases) / span;
});
const visitsToNext = computed(() =>
  nextTier.value && pass.value ? nextTier.value.min_purchases - pass.value.purchase_count : 0,
);
const artUrl = computed(() => {
  const query = new URLSearchParams({
    balance: pass.value?.balance ?? '0',
    purchases: String(pass.value?.purchase_count ?? 0),
    number: cardNumber.value,
  });
  return `/api/art/${props.program.slug}/${tierIndex.value}.svg?${query}`;
});
const expiresInDays = computed(() => {
  const expiresAt = pass.value?.expires_at_ns;
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt / 1e6 - Date.now()) / 86_400_000));
});

function isPerkClaimed(index: number): boolean {
  return ((pass.value?.claimed_perks ?? 0) & (1 << index)) !== 0;
}

function formatCardCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

function shortCode(code: string): string {
  const [token, sequence] = code.split('#');
  return `${token.split(':')[1] ?? ''}-${sequence}`;
}

async function findPass(accountId: string): Promise<PassView | null> {
  const passes = await getPassesByOwner(accountId);
  return passes.find((entry) => entry.program_slug === props.program.slug) ?? null;
}

function applyPass(next: PassView) {
  const previous = pass.value;
  pass.value = next;
  if (!previous || previous.token_id !== next.token_id) {
    activity.value = loadActivity(next.token_id);
    return;
  }
  if (next.purchase_count > previous.purchase_count) {
    const earned = baseUnitsToDollars(BigInt(next.balance) + BigInt(next.pending) - BigInt(previous.balance) - BigInt(previous.pending));
    activity.value = addActivity(next.token_id, {
      title: props.program.name,
      detail: `Visit ${next.purchase_count}`,
      amount: earned,
    });
    celebrate(earned);
    if (next.tier_index > previous.tier_index) {
      setTimeout(() => (levelUp.value = true), 900);
    }
  }
}

function celebrate(amount: number) {
  const entry = { id: Date.now(), amount };
  floats.value.push(entry);
  setTimeout(() => (floats.value = floats.value.filter((item) => item.id !== entry.id)), 1100);
  bump.value = true;
  setTimeout(() => (bump.value = false), 500);
}

async function refresh() {
  if (!wallet.value) return;
  const next = pass.value ? await getPass(pass.value.token_id) : await findPass(wallet.value.accountId);
  if (!next || next.owner !== wallet.value.accountId) {
    pass.value = null;
    if (screen.value === 'home' || screen.value === 'code') screen.value = 'waiting';
    return;
  }
  applyPass(next);
  if (screen.value === 'waiting') screen.value = 'home';
  listen();
}

function listen() {
  if (!wallet.value) return;
  const target = pass.value ? `token_id:${pass.value.token_id}` : `account_id:${wallet.value.accountId}`;
  if (target === subscribedTo) return;
  stopListening();
  subscribedTo = target;
  const [column, value] = target.split(/:(.+)/) as ['token_id' | 'account_id', string];
  unsubscribe = subscribeToEvents({
    column,
    value,
    onEvent: () => refresh().catch(() => undefined),
    onState: (state) => {
      const reconnected = state === 'live' && connection.value !== 'live';
      connection.value = state;
      if (reconnected) refresh().catch(() => undefined);
    },
  });
}

function stopListening() {
  unsubscribe?.();
  unsubscribe = undefined;
  subscribedTo = '';
}

async function join() {
  busy.value = true;
  error.value = '';
  try {
    wallet.value = loadWallet() ?? createWallet();
    const response = await fetch('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: props.program.slug, accountId: wallet.value.accountId }),
    });
    const body = (await response.json()) as { tokenId?: string | null; error?: string };
    if (!response.ok) throw new Error(body.error ?? 'JOIN_FAILED');
    await refresh();
    slide.value = 0;
    screen.value = 'intro';
    listen();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'JOIN_FAILED';
  } finally {
    busy.value = false;
  }
}

function finishIntro() {
  localStorage.setItem('fairly.intro.seen', '1');
  screen.value = pass.value ? 'home' : 'waiting';
}

async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
  busy.value = true;
  error.value = '';
  try {
    const result = await action();
    await refresh();
    return result;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    error.value = message.match(/[A-Z]+(?:_[A-Z]+)+/)?.[0] ?? 'Something went wrong. Try again.';
    return undefined;
  } finally {
    busy.value = false;
  }
}

async function useBalance() {
  if (!wallet.value || !pass.value || useAmount.value <= 0) return;
  const amount = Math.min(useAmount.value, balance.value);
  const code = await run(() => redeem(wallet.value!, pass.value!.token_id, dollarsToBaseUnits(amount)));
  if (!code) return;
  activity.value = addActivity(pass.value.token_id, { title: 'Used at the counter', detail: `Code ${shortCode(code)}`, amount: -amount });
  lastCode.value = shortCode(code);
  lastCodeLabel.value = `${formatMoney(dollarsToBaseUnits(amount))} off your bill`;
  sheet.value = 'code';
}

async function claim(index: number) {
  if (!wallet.value || !pass.value) return;
  const code = await run(() => claimPerk(wallet.value!, pass.value!.token_id, index));
  if (!code) return;
  lastCode.value = shortCode(code);
  lastCodeLabel.value = tiers.value[index].perk ?? 'Perk';
  levelUp.value = false;
  sheet.value = 'code';
}

async function sell() {
  if (!wallet.value || !pass.value) return;
  await run(() => listPass(wallet.value!, pass.value!.token_id, dollarsToBaseUnits(price.value)));
  if (pass.value?.listing_price) sheet.value = 'listed';
}

async function unlist() {
  if (!wallet.value || !pass.value) return;
  await run(() => cancelListing(wallet.value!, pass.value!.token_id));
  sheet.value = null;
}

async function simulatePurchase() {
  if (!pass.value) return;
  busy.value = true;
  error.value = '';
  try {
    const amountCents = 350 + Math.floor(Math.random() * 6) * 50;
    const response = await fetch('/api/demo/purchase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: pass.value.token_id, amountCents }),
    });
    const body = (await response.json()) as PurchaseResult & { error?: string };
    if (!response.ok) throw new Error(body.error ?? 'PURCHASE_FAILED');
    screen.value = 'home';
    await refresh();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'PURCHASE_FAILED';
  } finally {
    busy.value = false;
  }
}

function downloadBackup() {
  if (!wallet.value) return;
  const blob = new Blob([`Fairly card backup\nAccount: ${wallet.value.accountId}\nKey: ${wallet.value.secretKey}\n`], {
    type: 'text/plain',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `fairly-${props.program.slug}-backup.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

watch(sheet, (value) => {
  if (value === 'use') useAmount.value = Math.round((balance.value / 2) * 100) / 100;
  if (value === 'sell') price.value = Math.max(0.5, Math.round(balance.value * 0.9 * 2) / 2);
});

onMounted(async () => {
  wallet.value = loadWallet();
  if (!wallet.value) {
    screen.value = 'join';
    return;
  }
  await refresh().catch(() => undefined);
  screen.value = pass.value ? 'home' : 'waiting';
  listen();
});

onBeforeUnmount(stopListening);
</script>

<template>
  <div class="relative mx-auto flex min-h-[calc(100dvh-1.75rem)] max-w-[440px] flex-col overflow-hidden bg-cream">
    <div v-if="screen === 'loading'" class="grid flex-1 place-items-center text-ink/50">Loading your card…</div>

    <section v-else-if="screen === 'join'" class="relative flex flex-1 flex-col overflow-hidden bg-ink px-6 pt-10 pb-8 text-cream">
      <div class="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full opacity-25 blur-3xl" :style="{ background: program.brand_color }" />
      <div class="relative flex items-center gap-2 font-semibold">
        <span class="grid size-9 place-items-center rounded-full text-ink" :style="{ background: program.brand_color }"><AppIcon name="cup" class="size-5" /></span>
        {{ program.name }}
      </div>
      <div class="relative mt-6 aspect-[1.15] w-full">
        <img
          :src="`/api/art/${program.slug}/2.svg?balance=12400000&purchases=${tiers[2]?.min_purchases ?? 0}`"
          alt=""
          class="float absolute top-0 left-0 w-[86%] -rotate-6 rounded-[20px] shadow-card ring-1 ring-white/10"
        />
        <img
          :src="`/api/art/${program.slug}/0.svg?balance=1250000&purchases=1`"
          alt=""
          class="float absolute right-0 bottom-0 w-[86%] rotate-3 rounded-[20px] shadow-card ring-1 ring-white/10 [animation-delay:-2s]"
        />
      </div>
      <h1 class="relative mt-8 text-[44px] leading-[.95] font-extrabold tracking-tight">
        Get <span :style="{ color: program.brand_color }">{{ formatPercent(program.effective_cashback_bps) }}</span> back.<br />Every visit.
      </h1>
      <p class="relative mt-3 text-lg text-cream/70">Your card keeps the money.</p>
      <p v-if="error" class="relative mt-4 rounded-xl2 bg-white/10 px-4 py-3 text-sm font-semibold">{{ error }}</p>
      <button
        class="relative mt-auto flex h-16 shrink-0 items-center justify-between rounded-full bg-cream pr-2 pl-7 text-lg font-semibold text-ink transition active:scale-[.98] disabled:opacity-70"
        :disabled="busy"
        @click="join"
      >
        <span>{{ busy ? 'Creating your card…' : 'Get my card' }}</span>
        <span class="grid size-12 place-items-center rounded-full bg-sun text-ink"><AppIcon name="arrow" class="size-6" /></span>
      </button>
      <p class="relative mt-3 text-center text-sm text-cream/60">No app. No sign-up. <span class="font-mono text-xs opacity-70">(demo · test money)</span></p>
    </section>

    <section v-else-if="screen === 'intro'" class="relative flex h-[calc(100dvh-1.75rem)] flex-col pt-12 pb-8 transition-colors duration-500" :class="SLIDES[slide].background">
      <button class="mr-6 self-end text-sm font-semibold opacity-60 transition hover:opacity-100" @click="finishIntro">Skip</button>
      <div class="flex-1 overflow-hidden">
        <div class="flex h-full transition-transform duration-500 ease-[cubic-bezier(.22,.8,.2,1)]" :style="{ transform: `translateX(-${slide * 100}%)` }">
          <div v-for="(item, index) in SLIDES" :key="item.title" class="flex w-full shrink-0 flex-col px-6">
            <div class="grid flex-1 place-items-center">
              <img v-if="index === 0" :src="artUrl" alt="Your card" class="w-full rounded-[20px] shadow-card" />
              <div v-else-if="index === 1" class="size-60 rounded-2xl bg-white p-4 shadow-card">
                <QrCode :value="pass?.token_id ?? wallet?.accountId ?? ''" />
              </div>
              <p v-else class="text-7xl font-extrabold tracking-tight">+{{ formatPercent(program.effective_cashback_bps) }}</p>
            </div>
            <h2 class="text-4xl leading-none font-extrabold tracking-tight">{{ item.title }}</h2>
            <p class="mt-2 text-lg opacity-75">{{ item.text }}</p>
          </div>
        </div>
      </div>
      <div class="mt-8 flex items-center justify-between px-6">
        <div class="flex gap-1.5">
          <button
            v-for="index in SLIDES.length"
            :key="index"
            class="h-2 rounded-full transition-all duration-300"
            :class="index - 1 === slide ? 'w-7 bg-ink' : 'w-2 bg-ink/25'"
            :aria-label="`Slide ${index}`"
            @click="slide = index - 1"
          />
        </div>
        <button
          class="grid size-16 place-items-center rounded-full bg-ink text-white transition hover:scale-105 active:scale-95"
          aria-label="Next"
          @click="slide < SLIDES.length - 1 ? slide++ : finishIntro()"
        >
          <AppIcon name="arrow" class="size-7" />
        </button>
      </div>
    </section>

    <section v-else-if="screen === 'waiting'" class="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <p class="text-3xl font-extrabold tracking-tight">Show this at the counter</p>
      <p class="mt-2 text-ink/60">The cashier scans it to create your {{ program.name }} card.</p>
      <div class="mt-8 size-64 rounded-xl3 bg-white p-5 shadow-card"><QrCode :value="wallet?.accountId ?? ''" /></div>
      <p class="mt-6 animate-pulse text-sm text-ink/50">Waiting for your card…</p>
    </section>

    <section v-else-if="screen === 'home' && pass" class="flex flex-1 flex-col">
      <div class="flex-1 overflow-y-auto px-5 pt-8 pb-32">
        <header class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="grid size-11 place-items-center rounded-full font-bold" :style="{ background: program.brand_color, color: '#fff' }">
              {{ program.name.charAt(0) }}
            </span>
            <div>
              <p class="text-xs text-ink/55">{{ program.name }} club</p>
              <p class="flex items-center gap-1.5 text-lg leading-tight font-bold">
                Your card
                <span
                  class="size-2 rounded-full"
                  :class="{ 'bg-[#1F9D6B]': connection === 'live', 'animate-pulse bg-sun': connection === 'connecting', 'bg-coral': connection === 'offline' }"
                  :title="connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting' : 'Offline, reconnecting'"
                />
              </p>
            </div>
          </div>
          <button class="grid size-11 place-items-center rounded-full bg-white font-bold shadow-soft" aria-label="How it works" @click="sheet = 'help'">?</button>
        </header>

        <div class="relative mt-5">
          <img :src="artUrl" :alt="`${program.name} ${currentTier.name} card`" class="w-full rounded-[20px] shadow-card" :class="bump && 'animate-pop'" />
          <span
            v-for="item in floats"
            :key="item.id"
            class="absolute top-1/3 left-1/2 -translate-x-1/2 animate-rise rounded-full bg-sun px-4 py-1 text-2xl font-extrabold"
          >
            +{{ formatMoney(dollarsToBaseUnits(item.amount)) }}
          </span>
        </div>

        <p v-if="pending > 0" class="mt-3 rounded-xl2 bg-sun-soft px-4 py-3 text-sm">
          <b>Cashback pending: {{ formatMoney(pass.pending) }}</b> · it lands on your card as soon as {{ program.name }} tops up.
        </p>
        <p v-if="pass.listing_price" class="mt-3 rounded-xl2 bg-lilac-soft px-4 py-3 text-sm">
          <b>Listed for {{ formatMoney(pass.listing_price) }}</b> · <button class="font-semibold underline" @click="sheet = 'listed'">manage</button>
        </p>

        <div class="mt-4 flex items-center gap-4 rounded-xl2 bg-ink p-4 text-white">
          <div class="relative size-14 shrink-0">
            <svg viewBox="0 0 36 36" class="size-14 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#ffffff22" stroke-width="4" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#FFC23D"
                stroke-width="4"
                stroke-linecap="round"
                :stroke-dasharray="`${progress * 94} 94`"
                class="transition-all duration-700"
              />
            </svg>
            <AppIcon name="star" class="absolute inset-0 m-auto size-5 text-gold" />
          </div>
          <div class="flex-1">
            <p class="font-bold">
              {{ nextTier ? `${visitsToNext} ${visitsToNext === 1 ? 'visit' : 'visits'} to ${nextTier.name}` : `You reached ${currentTier.name}` }}
            </p>
            <p class="text-sm text-white/60">{{ nextTier?.perk ? `Unlocks: ${nextTier.perk}` : 'Top level unlocked' }}</p>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <button class="rounded-xl2 bg-sun p-4 text-left disabled:opacity-50" :disabled="balance <= 0 || !!pass.listing_price" @click="sheet = 'use'">
            <span class="grid size-10 place-items-center rounded-full bg-ink text-sun"><AppIcon name="tag" class="size-5" /></span>
            <p class="mt-6 leading-tight font-bold">Use balance</p>
            <p class="text-sm text-ink/60">On your next order</p>
          </button>
          <button class="rounded-xl2 bg-lilac p-4 text-left" @click="sheet = pass.listing_price ? 'listed' : 'sell'">
            <span class="grid size-10 place-items-center rounded-full bg-ink text-lilac"><AppIcon name="arrow" class="size-5 -rotate-45" /></span>
            <p class="mt-6 leading-tight font-bold">Sell card</p>
            <p class="text-sm text-ink/60">Value goes with it</p>
          </button>
        </div>

        <div class="mt-6 flex items-end justify-between">
          <h3 class="text-xl font-bold">Perks</h3>
          <span class="text-sm text-ink/50">{{ tierIndex + 1 }} of {{ tiers.length }} unlocked</span>
        </div>
        <div class="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 no-scrollbar">
          <div
            v-for="(tier, index) in tiers"
            :key="tier.name"
            class="relative w-40 shrink-0 rounded-xl2 p-4"
            :class="tierIndex >= index ? 'bg-white shadow-soft' : 'bg-ink/5'"
          >
            <span class="grid size-12 place-items-center rounded-full bg-sun-soft text-ink"><AppIcon :name="PERK_ICONS[index]" class="size-7" /></span>
            <p class="mt-4 leading-tight font-bold">{{ tier.perk ?? `${tier.name} level` }}</p>
            <button
              v-if="tier.perk && tierIndex >= index && !isPerkClaimed(index)"
              class="mt-2 text-xs font-semibold text-[#1F9D6B]"
              :disabled="busy"
              @click="claim(index)"
            >
              Claim now
            </button>
            <p v-else class="mt-2 text-xs font-semibold text-ink/45">
              {{ isPerkClaimed(index) ? 'Claimed' : tierIndex >= index ? 'Unlocked' : `${tier.name} level` }}
            </p>
          </div>
        </div>

        <h3 class="mt-6 text-xl font-bold">Activity</h3>
        <ul class="mt-2 space-y-2">
          <li v-for="entry in activity" :key="entry.id" class="flex items-center gap-3 rounded-xl2 bg-white p-3 shadow-soft">
            <span
              class="grid size-11 place-items-center rounded-full"
              :class="entry.amount > 0 ? 'bg-coral-soft text-coral' : 'bg-lilac-soft text-ink'"
            >
              <AppIcon :name="entry.amount > 0 ? 'cup' : 'tag'" class="size-5" />
            </span>
            <div class="flex-1">
              <p class="leading-tight font-semibold">{{ entry.title }}</p>
              <p class="text-xs text-ink/50">{{ entry.detail }}</p>
            </div>
            <span class="rounded-full px-3 py-1 text-sm font-bold" :class="entry.amount > 0 ? 'bg-sun' : 'bg-ink/5'">
              {{ entry.amount > 0 ? '+' : '-' }}{{ formatMoney(dollarsToBaseUnits(Math.abs(entry.amount))) }}
            </span>
          </li>
          <li v-if="!activity.length" class="rounded-xl2 border-2 border-dashed border-ink/10 p-5 text-center text-ink/50">
            {{ pass.purchase_count ? `${pass.purchase_count} visits so far` : 'Your first visit shows up here' }}
          </li>
        </ul>
        <p v-if="expiresInDays !== null" class="mt-6 text-center text-xs text-ink/45">
          Balance stays while you visit at least once every {{ program.expiry_days }} days ({{ expiresInDays }} days left).
        </p>
      </div>

      <nav class="fixed inset-x-0 bottom-0 mx-auto grid h-24 max-w-[440px] grid-cols-5 items-center rounded-t-xl3 bg-white text-ink/40 shadow-[0_-10px_30px_-15px_rgba(0,0,0,.2)]">
        <button class="grid place-items-center text-ink" aria-label="Home"><AppIcon name="home" class="size-6" /></button>
        <button class="grid place-items-center" aria-label="Levels" @click="sheet = 'levels'"><AppIcon name="star" class="size-6" /></button>
        <button class="grid place-items-center" aria-label="Show code" @click="screen = 'code'">
          <span class="-mt-10 grid size-16 place-items-center rounded-full bg-coral text-ink shadow-card ring-8 ring-cream"><AppIcon name="qr" class="size-7" /></span>
        </button>
        <a class="grid place-items-center" aria-label="Market" href="/market"><AppIcon name="list" class="size-6" /></a>
        <button class="grid place-items-center" aria-label="Backup" @click="sheet = 'help'"><AppIcon name="download" class="size-6" /></button>
      </nav>
    </section>

    <section v-else-if="screen === 'code' && pass" class="fixed inset-0 z-20 mx-auto flex max-w-[440px] flex-col bg-ink px-6 pt-10 pb-8 text-white">
      <button class="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Back" @click="screen = 'home'">
        <AppIcon name="back" class="size-5" />
      </button>
      <p class="mt-6 text-3xl leading-none font-extrabold tracking-tight">Show this<br />at the counter</p>
      <div class="mx-auto mt-8 size-72 animate-pop rounded-xl3 bg-white p-5"><QrCode :value="pass.token_id" /></div>
      <div class="mt-auto flex items-center gap-3 rounded-xl2 bg-white/10 p-4">
        <span class="grid size-11 place-items-center rounded-full bg-coral text-ink"><AppIcon name="cup" class="size-5" /></span>
        <div class="flex-1">
          <p class="font-semibold">{{ program.name }} · No. {{ cardNumber }}</p>
          <p class="text-sm text-white/60">{{ formatMoney(pass.balance) }} on card</p>
        </div>
      </div>
      <button
        v-if="isDemo"
        class="mt-3 h-12 rounded-full border border-white/20 text-sm text-white/80 disabled:opacity-50"
        :disabled="busy"
        @click="simulatePurchase"
      >
        {{ busy ? 'Recording purchase…' : 'Simulate a purchase' }} <span class="font-mono text-xs opacity-60">(demo)</span>
      </button>
    </section>

    <div v-if="levelUp" class="fixed inset-0 z-50 mx-auto flex max-w-[440px] flex-col items-center justify-center bg-gold px-8 text-center">
      <div class="grid size-32 animate-pop place-items-center rounded-full bg-white/40"><AppIcon :name="PERK_ICONS[tierIndex]" class="size-16" /></div>
      <p class="mt-8 text-lg font-semibold">You reached</p>
      <p class="text-6xl font-extrabold tracking-tight">{{ currentTier.name }}</p>
      <p v-if="currentTier.perk" class="mt-4 text-lg">Unlocked: <b>{{ currentTier.perk }}</b></p>
      <button v-if="currentTier.perk" class="mt-10 h-14 rounded-full bg-ink px-10 font-semibold text-white" :disabled="busy" @click="claim(tierIndex)">
        Claim perk
      </button>
      <button class="mt-3 h-12 px-6 font-semibold" @click="levelUp = false">Later</button>
    </div>

    <p v-if="error && screen !== 'join'" class="fixed inset-x-4 top-4 z-50 mx-auto max-w-[400px] rounded-xl2 bg-ink px-4 py-3 text-sm font-semibold text-white shadow-card">
      {{ error }}
      <button class="float-right opacity-60" aria-label="Dismiss" @click="error = ''">×</button>
    </p>

    <BottomSheet :open="sheet !== null" @close="sheet = null">
      <div v-if="sheet === 'use' && pass">
        <p class="text-sm text-ink/55">Available</p>
        <p class="text-5xl font-extrabold tracking-tight">{{ formatMoney(pass.balance) }}</p>
        <div class="mt-5 grid grid-cols-3 gap-2">
          <button
            v-for="(share, index) in [0.25, 0.5, 1]"
            :key="share"
            class="h-12 rounded-full bg-white font-semibold shadow-soft"
            @click="useAmount = Math.floor(balance * share * 100) / 100"
          >
            {{ ['Some', 'Half', 'All'][index] }}
          </button>
        </div>
        <input v-model.number="useAmount" type="range" min="0" :max="balance" step="0.01" class="mt-6 w-full accent-ink" />
        <button class="mt-5 h-14 w-full rounded-full bg-ink font-semibold text-white disabled:opacity-30" :disabled="useAmount <= 0 || busy" @click="useBalance">
          {{ busy ? 'Confirming…' : `Take ${formatMoney(dollarsToBaseUnits(useAmount))} off my bill` }}
        </button>
      </div>

      <div v-else-if="sheet === 'code'" class="text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-mint"><AppIcon name="check" class="size-8" /></span>
        <p class="mt-4 text-ink/60">Tell the cashier this code</p>
        <p class="mt-1 text-5xl font-extrabold tracking-[.15em]">{{ lastCode }}</p>
        <p class="mt-2 font-semibold">{{ lastCodeLabel }}</p>
        <button class="mt-6 h-14 w-full rounded-full bg-ink font-semibold text-white" @click="sheet = null">Done</button>
      </div>

      <div v-else-if="sheet === 'sell' && pass">
        <h3 class="text-3xl font-extrabold tracking-tight">Sell your card</h3>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="rounded-xl2 bg-sun p-4">
            <p class="text-sm text-ink/60">Value inside</p>
            <p class="text-3xl font-extrabold">{{ formatMoney(pass.balance) }}</p>
          </div>
          <div class="rounded-xl2 bg-lilac p-4">
            <p class="text-sm text-ink/60">Level</p>
            <p class="text-3xl font-extrabold">{{ currentTier.name }}</p>
          </div>
        </div>
        <div class="mt-5 flex items-end justify-between">
          <p class="font-semibold">Your price</p>
          <p class="text-3xl font-extrabold">{{ formatMoney(dollarsToBaseUnits(price)) }}</p>
        </div>
        <input v-model.number="price" type="range" min="0.5" :max="Math.max(20, Math.ceil(balance * 2))" step="0.5" class="mt-2 w-full accent-ink" />
        <div class="mt-3 flex justify-between text-sm">
          <span class="text-ink/60">You get</span><b>{{ formatMoney(dollarsToBaseUnits(price * (1 - royaltyShare))) }}</b>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-ink/60">{{ program.name }} gets</span><b>{{ formatMoney(dollarsToBaseUnits(price * royaltyShare)) }}</b>
        </div>
        <button class="mt-5 h-14 w-full rounded-full bg-ink font-semibold text-white disabled:opacity-40" :disabled="busy" @click="sell">
          {{ busy ? 'Listing…' : 'List for sale' }}
        </button>
      </div>

      <div v-else-if="sheet === 'listed' && pass" class="text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-lilac"><AppIcon name="tag" class="size-8" /></span>
        <h3 class="mt-4 text-3xl font-extrabold tracking-tight">Listed for {{ formatMoney(pass.listing_price ?? '0') }}</h3>
        <p class="mt-1 text-ink/60">Anyone can buy it on the market. The balance and level go with it.</p>
        <a href="/market" class="mt-6 grid h-14 w-full place-items-center rounded-full bg-ink font-semibold text-white">See it on the market</a>
        <button class="mt-2 h-12 w-full rounded-full font-semibold text-coral-dark" :disabled="busy" @click="unlist">
          {{ busy ? 'Cancelling…' : 'Cancel listing' }}
        </button>
      </div>

      <div v-else-if="sheet === 'levels'">
        <h3 class="text-3xl font-extrabold tracking-tight">Levels</h3>
        <div class="mt-4 space-y-2">
          <div
            v-for="(tier, index) in tiers"
            :key="tier.name"
            class="flex items-center gap-3 rounded-xl2 p-4"
            :class="tierIndex >= index ? 'bg-sun' : 'bg-ink/5'"
          >
            <span class="grid size-11 place-items-center rounded-full bg-white/60"><AppIcon :name="PERK_ICONS[index]" class="size-6" /></span>
            <div class="flex-1">
              <p class="font-bold">{{ tier.name }}</p>
              <p class="text-sm">{{ tier.perk ?? 'Cashback on every visit' }}</p>
            </div>
            <span class="text-sm font-semibold">{{ tier.min_purchases ? `${tier.min_purchases} visits` : 'Start' }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="sheet === 'help'">
        <h3 class="text-3xl font-extrabold tracking-tight">How it works</h3>
        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl2 bg-coral-soft p-4"><AppIcon name="qr" class="size-7" /><p class="mt-3 font-bold">Show code</p><p class="text-ink/60">when you pay</p></div>
          <div class="rounded-xl2 bg-sun-soft p-4"><AppIcon name="cup" class="size-7" /><p class="mt-3 font-bold">Earn {{ formatPercent(program.cashback_bps) }}</p><p class="text-ink/60">on every visit</p></div>
          <div class="rounded-xl2 bg-lilac-soft p-4"><AppIcon name="star" class="size-7" /><p class="mt-3 font-bold">Level up</p><p class="text-ink/60">unlock perks</p></div>
          <div class="rounded-xl2 bg-mint-soft p-4"><AppIcon name="tag" class="size-7" /><p class="mt-3 font-bold">Spend or sell</p><p class="text-ink/60">value stays inside</p></div>
        </div>
        <button class="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-white" @click="downloadBackup">
          <AppIcon name="download" class="size-5" /> Back up my card
        </button>
        <a v-if="wallet" :href="accountUrl(wallet.accountId)" target="_blank" rel="noopener" class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold shadow-soft">
          <AppIcon name="link" class="size-5" /> View on NEAR explorer
        </a>
        <button class="mt-2 h-12 w-full rounded-full font-semibold" @click="sheet = null; slide = 0; screen = 'intro'">Replay intro</button>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.float {
  animation: float 5s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -12px;
  }
}
</style>
