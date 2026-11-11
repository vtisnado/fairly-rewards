<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import InfoTip from '../ui/InfoTip.vue';
import QrScanner from './QrScanner.vue';
import type { IconName } from '../../lib/icons';
import type { PassView, ProgramView, PurchaseResult } from '../../lib/types';
import { getPass, getPassesByOwner, getProgram } from '../../lib/near';
import { BALANCE_CODE_PATTERN, cardCodeOf, compactCode, formatMoney, formatPercent, redemptionDisplayCode } from '../../lib/format';
import {
  honoredCodes,
  recentEvents,
  subscribeToInserts,
  type ConnectionState,
  type FairlyEvent,
  type HonoredCodeRow,
} from '../../lib/realtime';

type Step = 'scan' | 'amount' | 'done';
type Mode = 'buy' | 'code';

interface WaitingCode {
  display: string;
  tokenId: string;
  label: string;
}

const props = defineProps<{ initialProgram: ProgramView; locationId: string | null }>();

const CATEGORIES: [string, IconName][] = [
  ['Coffee', 'cup'],
  ['Food', 'burger'],
  ['Bakery', 'cookie'],
  ['Retail', 'bag'],
  ['Other', 'more'],
];
const BUY_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];
const CODE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', 'del'];
const GUIDE = [
  { title: 'Scan the code', text: 'The customer shows a code on their phone.', where: 'Camera area, or type the card code', icon: 'qr' as IconName },
  { title: 'Type the total', text: 'Optionally tag what they bought.', where: 'Keypad on the right (bottom on phones)', icon: 'tag' as IconName },
  { title: 'Tap Add to card', text: 'Cashback goes to their card instantly.', where: 'Coral button under the keypad', icon: 'check' as IconName },
];

const program = ref<ProgramView>(props.initialProgram);
const step = ref<Step>('scan');
const mode = ref<Mode>('buy');
const pass = ref<PassView | null>(null);
const newOwner = ref<string | null>(null);
const cents = ref(0);
const category = ref<string | null>(null);
const code = ref('');
const typedCard = ref('');
const camera = ref(false);
const cameraNote = ref('');
const busy = ref(false);
const error = ref('');
const doneTitle = ref('');
const doneSubtitle = ref('');
const recentCards = ref<string[]>([]);
const waitingCodes = ref<WaitingCode[]>([]);
const connection = ref<ConnectionState>('connecting');
const guide = ref(0);
const unsubscribers: (() => void)[] = [];

const location = computed(() => program.value.locations.find((entry) => entry.id === props.locationId) ?? null);
const today = computed(() => {
  const current = location.value;
  const isToday = current && current.cashback_day === Math.floor(Date.now() / 86_400_000);
  return isToday ? BigInt(current.cashback_today) : 0n;
});
const dailyCap = computed(() => BigInt(program.value.daily_cap));
const capShare = computed(() => (dailyCap.value ? Number((today.value * 1000n) / dailyCap.value) / 10 : 0));
const cashbackPreview = computed(() => String(BigInt(cents.value) * BigInt(program.value.effective_cashback_bps)));
const cardArt = computed(() => {
  if (!pass.value) {
    return `/api/art/${program.value.slug}/0.svg?balance=0&purchases=0`;
  }
  const query = new URLSearchParams({
    balance: pass.value.balance,
    purchases: String(pass.value.purchase_count),
    number: cardCodeOf(pass.value.token_id),
  });
  return `/api/art/${program.value.slug}/${pass.value.tier_index}.svg?${query}`;
});
const codeHint = computed(() => {
  const compact = compactCode(code.value);
  if (compact.length !== 6) return '';
  const match = waitingCodes.value.find((entry) => compactCode(entry.display).startsWith(compact));
  return match ? `Did you mean ${match.display}?` : 'That is the card number. Add the dash and number shown after it, like W8W-CYA-1.';
});
const codeSuggestion = computed(() =>
  waitingCodes.value.find((entry) => compactCode(code.value).length === 6 && compactCode(entry.display).startsWith(compactCode(code.value))),
);
const canConfirm = computed(() =>
  mode.value === 'buy' ? step.value === 'amount' && cents.value > 0 && !busy.value : BALANCE_CODE_PATTERN.test(compactCode(code.value)) && !busy.value,
);

function fail(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  error.value = {
    DAILY_CAP: 'Daily cashback limit reached at this location.',
    PAUSED: 'This program is paused.',
    CODE_NOT_FOUND: 'Code not found. Check it with the customer.',
    ALREADY_HONORED: 'This code was already used.',
    INVALID_CODE: 'That does not look like a balance code.',
    ALREADY_HAS_PASS: 'This customer already has a card.',
  }[message] ?? 'Something went wrong. Try again.';
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug: program.value.slug, ...body }),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'REQUEST_FAILED');
  return result;
}

async function identify(raw: string) {
  error.value = '';
  camera.value = false;
  const value = raw.trim();
  const slugPrefix = `${program.value.slug}:`;
  const cardCode = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  try {
    if (/^[0-9a-f]{64}$/.test(value)) {
      const existing = (await getPassesByOwner(value)).find((entry) => entry.program_slug === program.value.slug);
      pass.value = existing ?? null;
      newOwner.value = existing ? null : value;
    } else {
      const tokenId = value.startsWith(slugPrefix) ? value : `${slugPrefix}${cardCode}`;
      const found = await getPass(tokenId);
      if (!found) throw new Error('CARD_NOT_FOUND');
      pass.value = found;
      newOwner.value = null;
    }
    step.value = 'amount';
    mode.value = 'buy';
  } catch {
    error.value = 'Card not found. Check the code with the customer.';
  }
}

function press(key: string) {
  if (mode.value === 'code') {
    if (key === 'del') code.value = code.value.slice(0, -1);
    else if (code.value.length < 14) code.value += key;
    return;
  }
  if (key === 'del') cents.value = Math.floor(cents.value / 10);
  else {
    const next = Number(`${cents.value}${key}`);
    if (next <= 100_000) cents.value = next;
  }
}

async function confirm() {
  busy.value = true;
  error.value = '';
  try {
    if (mode.value === 'code') {
      const honored = await post<{ kind: 'redeem' | 'perk'; amount: string | null; perk: string | null }>('/api/cashier/honor', {
        code: code.value,
      });
      doneTitle.value = honored.kind === 'redeem' ? `${formatMoney(honored.amount ?? '0')} off` : honored.perk ?? 'Perk';
      doneSubtitle.value = honored.kind === 'redeem' ? 'Balance used. Charge the rest as usual.' : 'Perk claimed. Hand it over.';
      waitingCodes.value = waitingCodes.value.filter((entry) => compactCode(entry.display) !== compactCode(code.value));
      step.value = 'done';
      return;
    }
    let tokenId = pass.value?.token_id;
    if (!tokenId && newOwner.value) {
      tokenId = (await post<{ tokenId: string }>('/api/cashier/issue', { owner: newOwner.value })).tokenId;
    }
    const result = await post<PurchaseResult>('/api/cashier/purchase', {
      tokenId,
      amountCents: cents.value,
      category: category.value,
    });
    const tierName = program.value.tiers[result.tier_index]?.name;
    doneTitle.value = `+${formatMoney(result.cashback)}`;
    doneSubtitle.value = result.tier_up
      ? `Card reached ${tierName}`
      : `${newOwner.value ? 'New card created' : 'Added to the card'}${category.value ? ` · ${category.value}` : ''}`;
    if (BigInt(result.pending) > 0n) {
      doneSubtitle.value += ` · ${formatMoney(result.pending)} pending top-up`;
    }
    step.value = 'done';
  } catch (cause) {
    fail(cause);
  } finally {
    busy.value = false;
  }
}

function reset() {
  step.value = 'scan';
  mode.value = 'buy';
  pass.value = null;
  newOwner.value = null;
  cents.value = 0;
  code.value = '';
  typedCard.value = '';
  category.value = null;
  error.value = '';
}

async function loadRecentCards() {
  const events = await recentEvents(program.value.slug, ['pass_issued', 'purchase'], 60);
  recentCards.value = [...new Set(events.map((event) => event.token_id).filter((id): id is string => !!id))].slice(0, 6);
}

async function loadWaitingCodes() {
  const events = await recentEvents(program.value.slug, ['redeem', 'perk_claimed'], 60);
  const codes = events.map((event) => String(event.data.code));
  const honored = await honoredCodes(program.value.slug, codes);
  waitingCodes.value = events
    .filter((event) => !honored.has(String(event.data.code)))
    .map((event) => ({
      display: redemptionDisplayCode(String(event.data.code)),
      tokenId: event.token_id ?? '',
      label: event.event === 'redeem' ? formatMoney(String(event.data.amount)) : String(event.data.perk),
    }));
}

async function onEvent(event: FairlyEvent) {
  if (event.event === 'redeem' || event.event === 'perk_claimed') {
    loadWaitingCodes().catch(() => undefined);
    return;
  }
  if (event.event === 'purchase' || event.event === 'pool_funded' || event.event === 'pending_settled') {
    program.value = (await getProgram(program.value.slug)) ?? program.value;
  }
  if (event.event === 'pass_issued' || event.event === 'purchase') {
    loadRecentCards().catch(() => undefined);
  }
}

onMounted(() => {
  if (!localStorage.getItem('fairly.cashier.guide')) guide.value = 1;
  loadRecentCards().catch(() => undefined);
  loadWaitingCodes().catch(() => undefined);
  unsubscribers.push(
    subscribeToInserts<FairlyEvent>({
      column: 'program_slug',
      value: program.value.slug,
      onInsert: (event) => onEvent(event).catch(() => undefined),
      onState: (state) => (connection.value = state),
    }),
    subscribeToInserts<HonoredCodeRow>({
      table: 'honored_codes',
      column: 'program_slug',
      value: program.value.slug,
      onInsert: () => loadWaitingCodes().catch(() => undefined),
      onState: () => undefined,
    }),
  );
});

onBeforeUnmount(() => unsubscribers.forEach((unsubscribe) => unsubscribe()));

function closeGuide() {
  guide.value = 0;
  localStorage.setItem('fairly.cashier.guide', '1');
}
</script>

<template>
  <div class="min-h-[calc(100dvh-1.75rem)] bg-ink2 text-white lg:grid lg:grid-cols-[1fr_minmax(360px,420px)]">
    <section class="flex flex-col px-5 pt-6 pb-4 lg:p-8">
      <header class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-lg text-ink" :style="{ background: program.brand_color }"><AppIcon name="cup" class="size-5" /></span>
          <div>
            <p class="leading-tight font-bold">{{ program.name }}</p>
            <p class="flex items-center gap-1.5 text-xs text-white/50">
              {{ location?.name ?? 'Counter' }}
              <span
                class="size-1.5 rounded-full"
                :class="{ 'bg-mint': connection === 'live', 'animate-pulse bg-sun': connection === 'connecting', 'bg-coral': connection === 'offline' }"
              />
            </p>
          </div>
        </div>
        <div class="text-right">
          <p class="flex items-center justify-end gap-1 text-[11px] text-white/50">
            Cashback given today
            <InfoTip
              title="Cashback"
              text="Money this location added to customers' cards today, out of its daily limit. It comes from your cashback pool and customers spend it here later. Royalties you earn when a card is resold are tracked apart, in the dashboard."
            />
          </p>
          <div class="mt-1 flex items-center gap-2">
            <div class="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
              <div class="h-full rounded-full bg-sun transition-all" :style="{ width: `${Math.min(100, capShare)}%` }" />
            </div>
            <span class="text-xs font-semibold tabular-nums">{{ formatMoney(today) }} / {{ formatMoney(dailyCap) }}</span>
          </div>
        </div>
      </header>

      <div v-if="step === 'scan'" class="flex flex-1 flex-col items-center justify-center py-6">
        <button
          class="relative size-52 overflow-hidden rounded-2xl bg-black/40 lg:size-72"
          :aria-label="camera ? 'Stop camera' : 'Scan with camera'"
          @click="camera = !camera; cameraNote = ''"
        >
          <QrScanner v-if="camera" @detected="identify" @unavailable="(reason) => { camera = false; cameraNote = reason; }" />
          <span v-else class="absolute inset-0 grid place-items-center text-white/40"><AppIcon name="camera" class="size-10" /></span>
          <span class="absolute top-4 left-4 size-10 rounded-tl-xl border-t-4 border-l-4 border-coral" />
          <span class="absolute top-4 right-4 size-10 rounded-tr-xl border-t-4 border-r-4 border-coral" />
          <span class="absolute bottom-4 left-4 size-10 rounded-bl-xl border-b-4 border-l-4 border-coral" />
          <span class="absolute right-4 bottom-4 size-10 rounded-br-xl border-r-4 border-b-4 border-coral" />
          <span v-if="camera" class="scanline absolute inset-x-8 h-0.5 rounded-full bg-coral shadow-[0_0_18px_#F2654F]" />
        </button>
        <p class="mt-5 text-xl font-bold">Scan the customer's code</p>
        <p v-if="cameraNote" class="mt-1 text-sm text-white/50">{{ cameraNote }}</p>
        <form class="mt-4 flex w-full max-w-xs gap-2" @submit.prevent="identify(typedCard)">
          <input
            v-model="typedCard"
            class="h-11 min-w-0 flex-1 rounded-lg bg-white/10 px-3 font-mono tracking-widest uppercase placeholder:text-white/30 focus:ring-2 focus:ring-coral focus:outline-none"
            placeholder="Card code"
            aria-label="Card code"
            maxlength="7"
          />
          <button class="h-11 rounded-lg bg-white/15 px-4 text-sm font-semibold hover:bg-white/25" :disabled="!typedCard">Find</button>
        </form>
        <div v-if="recentCards.length" class="mt-5 w-full max-w-sm">
          <p class="text-center text-xs text-white/40">Recent cards <span class="font-mono opacity-70">(demo)</span></p>
          <div class="mt-2 flex flex-wrap justify-center gap-2">
            <button
              v-for="tokenId in recentCards"
              :key="tokenId"
              class="h-9 rounded-lg bg-white/10 px-3 font-mono text-sm font-semibold transition hover:bg-white/20"
              @click="identify(tokenId)"
            >
              {{ cardCodeOf(tokenId) }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-1 flex-col justify-center py-4">
        <div class="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-[420px]">
          <img :src="cardArt" alt="Customer card" class="w-full animate-pop rounded-[20px] shadow-card" />
          <div class="mt-4 flex items-center gap-3">
            <span class="grid size-9 place-items-center rounded-full font-bold text-ink" :class="newOwner ? 'bg-mint' : 'bg-lilac'">
              {{ newOwner ? '+' : pass?.tier_name.charAt(0) }}
            </span>
            <div class="flex-1">
              <p class="font-bold">{{ newOwner ? 'New member' : `Card ${cardCodeOf(pass?.token_id ?? '')}` }}</p>
              <p class="text-xs text-white/50">
                {{ newOwner ? 'The card is created with this purchase' : `${pass?.purchase_count} visits · ${pass?.tier_name} · ${formatMoney(pass?.balance ?? '0')}` }}
              </p>
            </div>
            <button class="h-9 rounded-lg bg-white/10 px-3 text-xs font-semibold transition hover:bg-white/20" @click="reset">Cancel</button>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col rounded-t-3xl bg-ink px-5 pt-4 pb-6 lg:rounded-none lg:p-6">
      <div class="grid grid-cols-2 rounded-xl bg-white/10 p-1 text-sm font-semibold">
        <button class="h-9 rounded-lg transition" :class="mode === 'buy' ? 'bg-white text-ink' : 'text-white/60'" @click="mode = 'buy'; error = ''">Purchase</button>
        <button class="h-9 rounded-lg transition" :class="mode === 'code' ? 'bg-white text-ink' : 'text-white/60'" @click="mode = 'code'; error = ''">Balance code</button>
      </div>

      <div v-if="mode === 'buy'" class="mt-4">
        <div class="flex items-end justify-between">
          <p class="text-5xl font-extrabold tracking-tight tabular-nums lg:text-6xl">${{ (cents / 100).toFixed(2) }}</p>
          <span v-if="cents > 0" class="flex h-8 items-center gap-1 rounded-lg bg-sun px-2.5 text-sm font-bold text-ink">
            +{{ formatMoney(cashbackPreview) }}
          </span>
        </div>
        <p class="mt-1 text-xs text-white/40">{{ formatPercent(program.effective_cashback_bps) }} cashback</p>
        <div class="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          <button
            v-for="[name, icon] in CATEGORIES"
            :key="name"
            class="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition"
            :class="category === name ? 'border-white bg-white text-ink' : 'border-white/15 text-white/70 hover:border-white/40'"
            @click="category = category === name ? null : name"
          >
            <AppIcon :name="icon" class="size-3.5" />{{ name }}
          </button>
        </div>
      </div>

      <div v-else class="mt-4">
        <p class="text-sm text-white/50">Code on the customer's phone</p>
        <p class="mt-2 h-14 rounded-xl bg-white/10 px-4 font-mono text-3xl leading-[3.5rem] font-extrabold tracking-widest uppercase">{{ code || ' ' }}</p>
        <p v-if="codeHint" class="mt-2 text-sm text-sun">
          {{ codeHint }}
          <button v-if="codeSuggestion" class="ml-1 font-semibold underline" @click="code = codeSuggestion.display">Use it</button>
        </p>
        <div v-if="waitingCodes.length" class="mt-3">
          <p class="text-xs text-white/40">Waiting at the counter</p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <button
              v-for="entry in waitingCodes"
              :key="entry.display"
              class="h-8 rounded-lg bg-mint/15 px-2.5 text-xs font-semibold text-mint transition hover:bg-mint/25"
              @click="code = entry.display"
            >
              <span class="font-mono">{{ entry.display }}</span> · {{ entry.label }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" class="mt-3 rounded-lg bg-coral/15 px-3 py-2 text-sm font-semibold text-coral" role="alert">{{ error }}</p>

      <div class="mt-auto grid grid-cols-3 gap-2 pt-3">
        <button
          v-for="key in mode === 'buy' ? BUY_KEYS : CODE_KEYS"
          :key="key"
          class="h-12 rounded-xl bg-white/[.07] text-2xl font-semibold transition hover:bg-white/15 active:scale-95 disabled:opacity-25 lg:h-14"
          :disabled="mode === 'buy' && step !== 'amount'"
          :aria-label="key === 'del' ? 'Delete' : key"
          @click="press(key)"
        >
          <AppIcon v-if="key === 'del'" name="back" class="mx-auto size-6" />
          <template v-else>{{ key }}</template>
        </button>
      </div>
      <input
        v-if="mode === 'code'"
        v-model="code"
        class="mt-2 h-10 rounded-lg bg-white/5 px-3 font-mono text-sm tracking-widest uppercase placeholder:text-white/30 focus:outline-none"
        placeholder="Or type letters here"
        aria-label="Balance code"
        maxlength="14"
      />
      <button
        class="mt-3 flex h-14 items-center justify-between rounded-xl bg-coral pr-2 pl-6 text-lg font-bold text-ink transition hover:brightness-105 disabled:opacity-25"
        :disabled="!canConfirm"
        @click="confirm"
      >
        <span>{{ busy ? 'Confirming…' : mode === 'code' ? 'Confirm' : newOwner ? 'Create card and add' : 'Add to card' }}</span>
        <span class="grid size-10 place-items-center rounded-lg bg-ink text-coral"><AppIcon name="check" class="size-5" /></span>
      </button>
    </section>

    <div v-if="step === 'done'" class="fixed inset-0 z-30 grid place-items-center bg-mint px-6 text-center text-ink">
      <div>
        <div class="mx-auto grid size-24 animate-pop place-items-center rounded-full bg-sun shadow-card"><AppIcon name="check" class="size-12" /></div>
        <p class="mt-5 text-5xl font-extrabold tracking-tight">{{ doneTitle }}</p>
        <p class="mt-2 text-lg">{{ doneSubtitle }}</p>
        <button class="mt-8 h-14 rounded-xl bg-ink px-8 font-semibold text-white transition hover:bg-black" @click="reset">Next customer</button>
      </div>
    </div>

    <div v-if="guide" class="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-8">
      <div class="w-full max-w-md rounded-2xl bg-white p-7 text-ink shadow-card">
        <div class="flex items-center gap-2">
          <span v-for="index in GUIDE.length" :key="index" class="h-1.5 flex-1 rounded-full" :class="index <= guide ? 'bg-coral' : 'bg-ink/10'" />
        </div>
        <div class="mt-6 flex items-center gap-4">
          <span class="grid size-14 place-items-center rounded-full bg-ink text-2xl font-extrabold text-white">{{ guide }}</span>
          <div>
            <p class="text-2xl font-extrabold">{{ GUIDE[guide - 1].title }}</p>
            <p class="text-ink/60">{{ GUIDE[guide - 1].text }}</p>
          </div>
        </div>
        <div class="mt-6 flex items-center gap-3 rounded-xl bg-bo-bg p-4 text-sm font-semibold">
          <span class="grid size-9 place-items-center rounded-lg bg-ink text-white"><AppIcon :name="GUIDE[guide - 1].icon" class="size-5" /></span>
          {{ GUIDE[guide - 1].where }}
        </div>
        <div class="mt-6 flex justify-between">
          <button class="h-11 rounded-lg px-4 font-semibold text-ink/50 hover:text-ink" @click="closeGuide">Skip</button>
          <button class="h-11 rounded-lg bg-ink px-6 font-semibold text-white transition hover:bg-black" @click="guide < GUIDE.length ? guide++ : closeGuide()">
            {{ guide < GUIDE.length ? 'Next' : 'Start' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scanline {
  animation: scan 2.2s ease-in-out infinite;
}

@keyframes scan {
  0%,
  100% {
    top: 15%;
  }
  50% {
    top: 82%;
  }
}
</style>
