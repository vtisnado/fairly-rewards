<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import BottomSheet from '../ui/BottomSheet.vue';
import BusySpinner from '../ui/BusySpinner.vue';
import type { IconName } from '../../lib/icons';
import type { PassView, ProgramView, PurchaseResult } from '../../lib/types';
import { accountUrl } from '../../lib/near';
import { baseUnitsToDollars, dollarsToBaseUnits, formatMoney, formatPercent, redemptionDisplayCode } from '../../lib/format';
import { cancelListing, claimPerk, listPass, redeem, type CustomerWallet } from '../../lib/customer-wallet';
import { cardNumberOf } from '../../lib/wallet-cards';
import { formatHistoryAmount, type HistoryEntry } from '../../lib/wallet-history';
import { showError } from '../../lib/toast';

type Sheet = 'use' | 'code' | 'sell' | 'listed' | 'levels' | null;

const props = defineProps<{
  pass: PassView;
  program: ProgramView;
  wallet: CustomerWallet;
  history: HistoryEntry[];
  otherCards: number;
  isDemo: boolean;
}>();
const emit = defineEmits<{ changed: []; backup: [] }>();

const PERK_ICONS: IconName[] = ['cookie', 'cup', 'gift', 'star', 'star'];

const sheet = ref<Sheet>(null);
const busy = ref(false);
const useAmount = ref(0);
const price = ref(4);
const lastCode = ref('');
const lastCodeLabel = ref('');

const tiers = computed(() => props.program.tiers);
const tierIndex = computed(() => props.pass.tier_index);
const currentTier = computed(() => tiers.value[tierIndex.value]!);
const nextTier = computed(() => tiers.value[tierIndex.value + 1] ?? null);
const balance = computed(() => baseUnitsToDollars(props.pass.balance));
const pending = computed(() => baseUnitsToDollars(props.pass.pending));
const royaltyShare = computed(() => props.program.royalty_bps / 10_000);
const progress = computed(() => {
  if (!nextTier.value) return 1;
  const span = nextTier.value.min_purchases - currentTier.value.min_purchases;
  return (props.pass.purchase_count - currentTier.value.min_purchases) / span;
});
const visitsToNext = computed(() => (nextTier.value ? nextTier.value.min_purchases - props.pass.purchase_count : 0));
const expiresInDays = computed(() => {
  const expiresAt = props.pass.expires_at_ns;
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt / 1e6 - Date.now()) / 86_400_000));
});

const isPerkClaimed = (index: number) => (props.pass.claimed_perks & (1 << index)) !== 0;

async function run<T>(action: () => Promise<T>, step: string): Promise<T | undefined> {
  if (busy.value) return undefined;
  busy.value = true;
  try {
    const result = await action();
    emit('changed');
    return result;
  } catch (cause) {
    showError(step, cause);
    return undefined;
  } finally {
    busy.value = false;
  }
}

async function useBalance() {
  if (useAmount.value <= 0) return;
  const amount = Math.min(useAmount.value, balance.value);
  const code = await run(() => redeem(props.wallet, props.pass.token_id, dollarsToBaseUnits(amount)), 'use your balance');
  if (!code) return;
  lastCode.value = redemptionDisplayCode(code);
  lastCodeLabel.value = `${formatMoney(dollarsToBaseUnits(amount))} off your bill`;
  sheet.value = 'code';
}

async function claim(index: number) {
  const code = await run(() => claimPerk(props.wallet, props.pass.token_id, index), 'claim the perk');
  if (!code) return;
  lastCode.value = redemptionDisplayCode(code);
  lastCodeLabel.value = tiers.value[index]?.perk ?? 'Perk';
  sheet.value = 'code';
}

async function sell() {
  await run(() => listPass(props.wallet, props.pass.token_id, dollarsToBaseUnits(price.value)), 'list your card');
  sheet.value = 'listed';
}

async function unlist() {
  await run(() => cancelListing(props.wallet, props.pass.token_id), 'cancel the listing');
  sheet.value = null;
}

async function simulatePurchase() {
  if (busy.value) return;
  busy.value = true;
  try {
    const amountCents = 350 + Math.floor(Math.random() * 6) * 50;
    const response = await fetch('/api/demo/purchase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenId: props.pass.token_id, amountCents }),
    });
    const body = (await response.json()) as PurchaseResult & { error?: string };
    if (!response.ok) throw new Error(body.error ?? 'PURCHASE_FAILED');
    emit('changed');
  } catch (cause) {
    showError('record the purchase', cause);
  } finally {
    busy.value = false;
  }
}

watch(sheet, (value) => {
  if (value === 'use') useAmount.value = Math.round((balance.value / 2) * 100) / 100;
  if (value === 'sell') price.value = Math.max(0.5, Math.round(balance.value * 0.9 * 2) / 2);
});
</script>

<template>
  <p class="ei text-center text-xs font-semibold text-ink/50" style="--i: 1">{{ program.name }} · No. {{ cardNumberOf(pass) }}</p>

  <div v-if="pending > 0" class="ei mt-2 rounded-xl2 bg-sun-soft px-4 py-3 text-sm" style="--i: 1">
    <b>Cashback pending: {{ formatMoney(pass.pending) }}</b> · it lands on your card as soon as {{ program.name }} tops up.
  </div>
  <div v-if="pass.listing_price" class="ei mt-2 rounded-xl2 bg-lilac-soft px-4 py-3 text-sm" style="--i: 1">
    <b>Listed for {{ formatMoney(pass.listing_price) }}</b> · <button class="font-semibold underline" @click="sheet = 'listed'">manage</button>
  </div>

  <button class="ei mt-2 flex w-full items-center gap-4 rounded-xl2 bg-ink p-4 text-left text-white" style="--i: 1" @click="sheet = 'levels'">
    <div class="relative size-14 shrink-0">
      <svg viewBox="0 0 36 36" class="size-14 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#ffffff22" stroke-width="4" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="#FFC23D"
          stroke-width="4"
          stroke-linecap="round"
          :stroke-dasharray="`${Math.max(0, progress) * 94} 94`"
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
  </button>

  <div class="ei mt-2 grid grid-cols-3 gap-2" style="--i: 2">
    <button class="rounded-xl2 bg-sun p-3 text-left disabled:opacity-50" :disabled="balance <= 0 || !!pass.listing_price" @click="sheet = 'use'">
      <span class="grid size-8 place-items-center rounded-full bg-ink text-sun"><AppIcon name="tag" class="size-4" /></span>
      <p class="mt-3 text-sm leading-tight font-bold">Use balance</p>
    </button>
    <button class="rounded-xl2 bg-lilac p-3 text-left" @click="sheet = pass.listing_price ? 'listed' : 'sell'">
      <span class="grid size-8 place-items-center rounded-full bg-ink text-lilac"><AppIcon name="arrow" class="size-4 -rotate-45" /></span>
      <p class="mt-3 text-sm leading-tight font-bold">Sell this card</p>
    </button>
    <button class="rounded-xl2 bg-mint p-3 text-left" @click="emit('backup')">
      <span class="grid size-8 place-items-center rounded-full bg-ink text-mint"><AppIcon name="download" class="size-4" /></span>
      <p class="mt-3 text-sm leading-tight font-bold">Backup</p>
    </button>
  </div>

  <p class="ei mt-2 rounded-xl2 bg-lilac-soft p-4 text-sm" style="--i: 2">
    <b>Selling moves only this card</b> and the {{ formatMoney(pass.balance) }} inside it.
    {{ otherCards > 0 ? `Your other ${otherCards} ${otherCards === 1 ? 'card stays' : 'cards stay'} here.` : '' }}
    {{ program.name }} gets {{ formatPercent(program.royalty_bps) }} of the price.
  </p>

  <div class="ei" style="--i: 3">
    <div class="mt-5 flex items-end justify-between">
      <h3 class="text-lg font-bold">Perks</h3>
      <span class="text-sm text-ink/50">{{ tierIndex + 1 }} of {{ tiers.length }} unlocked</span>
    </div>
    <div class="no-scrollbar -mx-5 mt-2 flex gap-3 overflow-x-auto px-5">
      <div
        v-for="(tier, index) in tiers"
        :key="tier.name"
        class="relative w-40 shrink-0 rounded-xl2 p-4"
        :class="tierIndex >= index ? 'bg-white shadow-soft' : 'bg-ink/5'"
      >
        <span class="grid size-12 place-items-center rounded-full bg-sun-soft text-ink"><AppIcon :name="PERK_ICONS[index] ?? 'star'" class="size-7" /></span>
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

    <h3 class="mt-5 text-lg font-bold">History</h3>
    <ul class="mt-2 space-y-2">
      <li v-for="entry in history" :key="entry.id" class="flex items-center gap-3 rounded-xl2 bg-white p-3 shadow-soft">
        <span class="grid size-10 place-items-center rounded-full" :class="entry.kind === 'purchase' ? 'bg-coral-soft text-coral' : 'bg-lilac-soft text-ink'">
          <AppIcon :name="entry.kind === 'purchase' ? 'cup' : entry.kind === 'sale' ? 'arrow' : 'tag'" class="size-5" />
        </span>
        <div class="flex-1">
          <p class="leading-tight font-semibold">{{ entry.title }}</p>
          <p class="text-xs text-ink/50">{{ entry.detail }}</p>
        </div>
        <span v-if="entry.amount !== null" class="rounded-full px-3 py-1 text-sm font-bold" :class="entry.credit ? 'bg-sun' : 'bg-ink/5'">{{ formatHistoryAmount(entry) }}</span>
      </li>
      <li v-if="!history.length" class="rounded-xl2 border-2 border-dashed border-ink/10 p-5 text-center text-ink/50">
        {{ pass.purchase_count ? `${pass.purchase_count} visits so far` : 'Your first visit shows up here' }}
      </li>
    </ul>

    <a :href="accountUrl(wallet.accountId)" target="_blank" rel="noopener" class="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink/50">
      <AppIcon name="link" class="size-4" />View on explorer
    </a>
    <p v-if="expiresInDays !== null" class="mt-3 text-center text-xs text-ink/45">
      Balance stays while you visit at least once every {{ program.expiry_days }} days ({{ expiresInDays }} days left).
    </p>
    <button
      v-if="isDemo"
      class="mt-4 h-12 w-full rounded-full border border-ink/15 text-sm text-ink/70 disabled:opacity-50"
      :disabled="busy"
      @click="simulatePurchase"
    >
      {{ busy ? 'Recording purchase…' : 'Simulate a purchase' }} <span class="font-mono text-xs opacity-60">(demo)</span>
    </button>
  </div>

  <BottomSheet :open="sheet !== null" @close="sheet = null">
    <div v-if="sheet === 'use'">
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

    <div v-else-if="sheet === 'sell'">
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

    <div v-else-if="sheet === 'listed'" class="text-center">
      <span class="mx-auto grid size-16 place-items-center rounded-full bg-lilac"><AppIcon name="tag" class="size-8" /></span>
      <h3 class="mt-4 text-3xl font-extrabold tracking-tight">Listed for {{ formatMoney(pass.listing_price ?? '0') }}</h3>
      <p class="mt-1 text-ink/60">Anyone can buy it on the market. The balance and level go with it.</p>
      <a href="/market" class="mt-6 grid h-14 w-full place-items-center rounded-full bg-ink font-semibold text-white">See it on the market</a>
      <button class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold text-coral-dark" :disabled="busy" @click="unlist">
        <BusySpinner v-if="busy" />{{ busy ? 'Cancelling…' : 'Cancel listing' }}
      </button>
    </div>

    <div v-else-if="sheet === 'levels'">
      <h3 class="text-3xl font-extrabold tracking-tight">Levels</h3>
      <div class="mt-4 space-y-2">
        <div v-for="(tier, index) in tiers" :key="tier.name" class="flex items-center gap-3 rounded-xl2 p-4" :class="tierIndex >= index ? 'bg-sun' : 'bg-ink/5'">
          <span class="grid size-11 place-items-center rounded-full bg-white/60"><AppIcon :name="PERK_ICONS[index] ?? 'star'" class="size-6" /></span>
          <div class="flex-1">
            <p class="font-bold">{{ tier.name }}</p>
            <p class="text-sm">{{ tier.perk ?? 'Cashback on every visit' }}</p>
          </div>
          <span class="text-sm font-semibold">{{ tier.min_purchases ? `${tier.min_purchases} visits` : 'Start' }}</span>
        </div>
      </div>
    </div>
  </BottomSheet>
</template>
