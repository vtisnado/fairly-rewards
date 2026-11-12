<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import SelectMenu from '../ui/SelectMenu.vue';
import { BUSINESS_TYPES, businessTypeOf } from '../../lib/business-types';
import { buyPass, cancelListing, ensureCustomer, loadWallet } from '../../lib/customer-wallet';
import { cardCodeOf, formatMoney, formatPercent } from '../../lib/format';
import { getListings, getPassesByOwner, getProgram } from '../../lib/near';
import { subscribeToInserts, type FairlyEvent } from '../../lib/realtime';
import type { ListingView, ProgramView } from '../../lib/types';

type Sort = 'save' | 'value' | 'price' | 'level';

const listings = ref<ListingView[]>([]);
const programs = ref(new Map<string, ProgramView>());
const ownedSlugs = ref(new Set<string>());
const accountId = ref<string | null>(null);
const loading = ref(true);
const filter = ref<number | null>(null);
const sort = ref<Sort>('save');
const picked = ref<ListingView | null>(null);
const busy = ref(false);
const step = ref('');
const error = ref('');
const bought = ref<ListingView | null>(null);
let unsubscribers: (() => void)[] = [];

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'save', label: 'Biggest savings' },
  { value: 'value', label: 'Most value inside' },
  { value: 'price', label: 'Lowest price' },
  { value: 'level', label: 'Highest level' },
];

const ERRORS: Record<string, string> = {
  RATE_LIMITED: 'Too many tries from this connection. Try again in a while.',
  NOT_BOUGHT: 'The card was not transferred and your test dollars came back. It may have just been sold.',
};

const programOf = (listing: ListingView) => programs.value.get(listing.program_slug);
const mccOf = (listing: ListingView) => programOf(listing)?.mcc ?? 0;
const royaltyBps = (listing: ListingView) => programOf(listing)?.royalty_bps ?? 0;
const saving = (listing: ListingView) => Number(listing.balance) - Number(listing.price);
const savingShare = (listing: ListingView) => (Number(listing.balance) > 0 ? saving(listing) / Number(listing.balance) : 0);
const royaltyOf = (listing: ListingView) => (BigInt(listing.price) * BigInt(royaltyBps(listing))) / 10_000n;
const artUrl = (listing: ListingView) =>
  `/api/art/${listing.program_slug}/${listing.tier_index}.svg?${new URLSearchParams({
    balance: listing.balance,
    purchases: String(listing.purchase_count),
    number: cardCodeOf(listing.token_id),
  })}`;

const categories = computed(() => {
  const present = new Set(listings.value.map((listing) => businessTypeOf(mccOf(listing)).mcc));
  return BUSINESS_TYPES.filter((type) => present.has(type.mcc));
});

const visible = computed(() => {
  const rows = listings.value.filter((listing) => filter.value === null || businessTypeOf(mccOf(listing)).mcc === filter.value);
  const key: Record<Sort, (listing: ListingView) => number> = {
    save: (listing) => -saving(listing),
    value: (listing) => -Number(listing.balance),
    price: (listing) => Number(listing.price),
    level: (listing) => -listing.tier_index,
  };
  return [...rows].sort((a, b) => key[sort.value](a) - key[sort.value](b));
});

const pickedIsMine = computed(() => !!picked.value && picked.value.seller === accountId.value);
const pickedBlocked = computed(() => !!picked.value && !pickedIsMine.value && ownedSlugs.value.has(picked.value.program_slug));

async function load() {
  const rows = await getListings();
  const slugs = [...new Set(rows.map((row) => row.program_slug))].filter((slug) => !programs.value.has(slug));
  const loaded = await Promise.all(slugs.map((slug) => getProgram(slug).catch(() => null)));
  const next = new Map(programs.value);
  for (const program of loaded) if (program) next.set(program.slug, program);
  programs.value = next;
  listings.value = rows;
  loading.value = false;
}

async function loadOwned() {
  if (!accountId.value) return;
  const passes = await getPassesByOwner(accountId.value).catch(() => []);
  ownedSlugs.value = new Set(passes.map((pass) => pass.program_slug));
}

function open(listing: ListingView) {
  picked.value = listing;
  error.value = '';
  step.value = '';
}

async function buy() {
  const listing = picked.value;
  if (!listing) return;
  busy.value = true;
  error.value = '';
  try {
    step.value = 'Preparing your account';
    const wallet = await ensureCustomer();
    accountId.value = wallet.accountId;
    step.value = `Getting ${formatMoney(listing.price)} in test dollars and paying`;
    const done = await buyPass(wallet, listing.token_id, listing.price);
    if (!done) throw new Error('NOT_BOUGHT');
    bought.value = listing;
    picked.value = null;
    await Promise.all([load(), loadOwned()]);
  } catch (cause) {
    error.value = ERRORS[cause instanceof Error ? cause.message : ''] ?? 'The purchase did not go through. Try again.';
  } finally {
    busy.value = false;
    step.value = '';
  }
}

async function unlist() {
  const wallet = await loadWallet();
  if (!wallet || !picked.value) return;
  busy.value = true;
  try {
    await cancelListing(wallet, picked.value.token_id);
    picked.value = null;
    await load();
  } catch {
    error.value = 'The listing was not cancelled. Try again.';
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  accountId.value = (await loadWallet())?.accountId ?? null;
  await Promise.all([load(), loadOwned()]);
  for (const event of ['listed', 'listing_cancelled', 'sale']) {
    unsubscribers.push(
      subscribeToInserts<FairlyEvent>({ column: 'event', value: event, onInsert: () => load().catch(() => undefined), onState: () => undefined }),
    );
  }
});

onBeforeUnmount(() => unsubscribers.forEach((unsubscribe) => unsubscribe()));
</script>

<template>
  <div>
    <header class="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
      <a href="/" class="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <span class="grid size-8 place-items-center rounded-full bg-coral text-sm font-black">F</span>Fairly
      </a>
      <nav class="flex items-center gap-6 text-sm font-semibold">
        <a href="/" class="text-ink/55 transition hover:text-ink">Home</a>
        <a href="/business" class="text-ink/55 transition hover:text-ink">For businesses</a>
      </nav>
    </header>

    <main class="mx-auto max-w-7xl px-6 pb-16">
      <section class="relative overflow-hidden rounded-xl3 bg-ink p-10 text-white lg:p-14">
        <div class="relative z-10 max-w-lg">
          <h1 class="text-5xl leading-[.95] font-extrabold tracking-tight lg:text-6xl">Cards with money already inside</h1>
          <p class="mt-4 text-xl text-white/60">People move. Their cards do not have to go to waste. Buy one and start at their level.</p>
          <p class="mt-4 text-sm text-white/40">The shop gets a share of every resale. Paid with test dollars on NEAR testnet.</p>
        </div>
        <img
          v-if="listings[0]"
          :src="artUrl(listings[0])"
          alt=""
          class="absolute top-10 right-10 hidden w-80 rotate-[8deg] rounded-[20px] shadow-card lg:block"
        />
      </section>

      <div class="mt-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <button
          type="button"
          class="flex h-10 items-center gap-2 rounded-xl border px-4 transition"
          :class="filter === null ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-white hover:border-ink/40'"
          @click="filter = null"
        >
          All
        </button>
        <button
          v-for="type in categories"
          :key="type.mcc"
          type="button"
          class="flex h-10 items-center gap-2 rounded-xl border px-4 transition"
          :class="filter === type.mcc ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-white hover:border-ink/40'"
          @click="filter = type.mcc"
        >
          <AppIcon :name="type.icon" class="size-4" />{{ type.name }}
        </button>
        <div class="ml-auto flex items-center gap-2 text-ink/60">
          Sort by
          <SelectMenu v-model="sort" class="w-52 text-ink" :options="SORT_OPTIONS" label="Sort by" />
        </div>
      </div>
      <p class="mt-4 text-sm font-semibold text-ink/50">{{ loading ? 'Loading cards…' : `${visible.length} ${visible.length === 1 ? 'card' : 'cards'} for sale` }}</p>

      <p v-if="!loading && !visible.length" class="mt-6 rounded-xl3 border border-dashed border-ink/15 p-10 text-center text-ink/60">
        No cards for sale right now. Cards listed from the customer screen show up here at once.
      </p>
      <div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article v-for="listing in visible" :key="listing.token_id" class="rounded-xl3 bg-white p-5 shadow-soft transition hover:-translate-y-1">
          <img :src="artUrl(listing)" :alt="`${listing.program_name} ${listing.tier_name} card`" class="w-full rounded-[18px]" />
          <p class="mt-4 flex items-center gap-2 text-sm font-semibold text-ink/60">
            <AppIcon :name="businessTypeOf(mccOf(listing)).icon" class="size-4" />{{ listing.program_name }} · {{ listing.tier_name }}
          </p>
          <div class="mt-3 flex items-center gap-3">
            <div class="flex-1 rounded-xl2 bg-sun p-3"><p class="text-xs font-semibold text-ink/60">Inside</p><p class="text-2xl font-extrabold">{{ formatMoney(listing.balance) }}</p></div>
            <div class="flex-1 rounded-xl2 bg-cream p-3"><p class="text-xs font-semibold text-ink/60">Price</p><p class="text-2xl font-extrabold">{{ formatMoney(listing.price) }}</p></div>
          </div>
          <button
            type="button"
            class="mt-3 flex h-14 w-full items-center justify-between rounded-xl bg-ink pr-2 pl-6 font-semibold text-white transition hover:bg-black"
            :aria-label="`Buy ${listing.program_name} card ${cardCodeOf(listing.token_id)}`"
            @click="open(listing)"
          >
            <span>{{ saving(listing) > 0 ? `Save ${formatMoney(String(saving(listing)))} (${Math.round(savingShare(listing) * 100)}%)` : `${listing.tier_name} level` }}</span>
            <span class="grid size-10 place-items-center rounded-lg bg-coral text-ink"><AppIcon name="arrow" class="size-5" /></span>
          </button>
        </article>
      </div>
    </main>

    <div v-if="picked" class="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-6" role="dialog" aria-modal="true" :aria-label="`${picked.program_name} card`" @click.self="!busy && (picked = null)">
      <div class="w-full max-w-md animate-pop rounded-xl3 bg-cream p-8">
        <img :src="artUrl(picked)" alt="" class="w-full rotate-[-3deg] rounded-[20px] shadow-card" />
        <div class="mt-6 space-y-2">
          <div class="flex justify-between rounded-full bg-white px-5 py-3"><span class="text-ink/60">Inside the card</span><b>{{ formatMoney(picked.balance) }}</b></div>
          <div class="flex justify-between rounded-full bg-white px-5 py-3"><span class="text-ink/60">You pay</span><b>{{ formatMoney(picked.price) }}</b></div>
          <div class="flex justify-between rounded-full bg-white px-5 py-3"><span class="text-ink/60">Seller gets</span><b>{{ formatMoney(String(BigInt(picked.price) - royaltyOf(picked))) }}</b></div>
          <div class="flex justify-between rounded-full bg-white px-5 py-3">
            <span class="text-ink/60">{{ picked.program_name }} gets ({{ formatPercent(royaltyBps(picked)) }})</span><b>{{ formatMoney(String(royaltyOf(picked))) }}</b>
          </div>
        </div>
        <p class="mt-4 text-sm text-ink/60">The balance, level and visits move to you. You keep earning {{ formatPercent(programOf(picked)?.cashback_bps ?? 0) }} back at {{ picked.program_name }}.</p>
        <p v-if="pickedBlocked" class="mt-4 rounded-xl2 bg-white px-4 py-3 text-sm font-semibold">You already have a {{ picked.program_name }} card on this phone. Each person holds one card per shop.</p>
        <p v-if="error" class="mt-4 rounded-xl2 bg-coral-soft px-4 py-3 text-sm font-semibold" role="alert">{{ error }}</p>
        <p v-if="step" class="mt-4 flex items-center gap-2 text-sm font-semibold"><span class="size-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />{{ step }}</p>
        <button
          v-if="pickedIsMine"
          type="button"
          class="mt-6 h-14 w-full rounded-full bg-ink font-bold text-white disabled:opacity-40"
          :disabled="busy"
          @click="unlist"
        >
          {{ busy ? 'Cancelling…' : 'Cancel my listing' }}
        </button>
        <button v-else type="button" class="mt-6 h-14 w-full rounded-full bg-coral font-bold disabled:opacity-40" :disabled="busy || pickedBlocked" @click="buy">
          {{ busy ? 'Buying…' : `Buy for ${formatMoney(picked.price)}` }}
        </button>
        <p class="mt-3 text-center text-xs text-ink/50">Test dollars come from the testnet faucet. No real money moves.</p>
      </div>
    </div>

    <div v-if="bought" class="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-6" role="dialog" aria-modal="true" aria-label="Card bought">
      <div class="w-full max-w-md animate-pop rounded-xl3 bg-mint p-10 text-center">
        <span class="mx-auto grid size-20 place-items-center rounded-full bg-ink text-mint"><AppIcon name="check" class="size-10" /></span>
        <p class="mt-5 text-4xl font-extrabold">It is yours</p>
        <p class="mt-2">The {{ bought.program_name }} card and its {{ formatMoney(bought.balance) }} are on this phone now.</p>
        <a :href="`/join/${bought.program_slug}`" class="mt-6 inline-flex h-14 items-center rounded-full bg-ink px-8 font-semibold text-white">Open my card</a>
      </div>
    </div>
  </div>
</template>
