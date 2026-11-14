<script setup lang="ts">
import '../../styles/wallet.css';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import BottomSheet from '../ui/BottomSheet.vue';
import BusySpinner from '../ui/BusySpinner.vue';
import InstallPrompt from '../ui/InstallPrompt.vue';
import SortMenu from './SortMenu.vue';
import ShortcutCodeEntry from '../ui/ShortcutCodeEntry.vue';
import ShortcutConnect from '../ui/ShortcutConnect.vue';
import ToastStack from '../ui/ToastStack.vue';
import CardDetail from './CardDetail.vue';
import CodeScreen from './CodeScreen.vue';
import IntroSlides from './IntroSlides.vue';
import type { PassView, ProgramView } from '../../lib/types';
import { accountUrl, getPassesByOwner, getProgram } from '../../lib/near';
import { formatMoney, redemptionDisplayCode } from '../../lib/format';
import { backupKey, createWallet, CUSTOMER_STORAGE_KEY, loadWallet, type CustomerWallet } from '../../lib/customer-wallet';
import { backupText, type BrowserWallet } from '../../lib/browser-wallet';
import type { IconName } from '../../lib/icons';
import { claimPerk } from '../../lib/customer-wallet';
import { installModeNow, isStandalone } from '../../lib/install';
import { linkEmail, nearAuthAvailable, nearAuthMessage } from '../../lib/near-auth';
import { subscribeToEvents, type ConnectionState } from '../../lib/realtime';
import { showError, showToast } from '../../lib/toast';
import { useRecovery } from '../../lib/use-recovery';
import {
  CARD_ASPECT,
  SORT_OPTIONS,
  TIER_COLORS,
  cardArtUrl,
  formatDistance,
  nearestDistance,
  sortPasses,
  totalBalance,
  type Position,
  type SortKey,
} from '../../lib/wallet-cards';
import { loadHistory, type HistoryEntry } from '../../lib/wallet-history';

type Screen = 'loading' | 'shortcut' | 'home' | 'code';
type Sheet = 'help' | 'protect' | 'connect' | 'perk' | null;

const PERK_ICONS: IconName[] = ['cookie', 'cup', 'gift', 'star', 'star'];

const props = defineProps<{ initialSlug: string | null; demoSlug: string }>();

const SORT_KEY = 'fairly.wallet.sort';
const WELCOMED_KEY = 'fairly.wallet.welcomed';
const PROTECT_DISMISSED_KEY = 'fairly.customer.protect-later';
const EMAIL_KEY = 'fairly.customer.email';
const CARD_TOP = 92;
const STACK_STEP = 72;
const connectNote =
  'On iPhone the home screen app starts empty. You connect it once with a code: open the wallet in Safari, tap ? and choose Connect home screen app. Cards you add later need no new connection.';

const screenEl = ref<HTMLElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
const codeScreen = ref<InstanceType<typeof CodeScreen> | null>(null);
const installPrompt = ref<InstanceType<typeof InstallPrompt> | null>(null);

const screen = ref<Screen>('loading');
const sheet = ref<Sheet>(null);
const wallet = ref<CustomerWallet | null>(null);
const passes = ref<PassView[]>([]);
const programs = ref<Record<string, ProgramView>>({});
const loaded = ref(false);
const sort = ref<SortKey>(storedSort());
const sortOpen = ref(false);
const position = ref<Position | null>(null);
const history = ref<HistoryEntry[]>([]);
const welcome = ref<string | null>(null);
const levelUp = ref<PassView | null>(null);
const introProgram = ref<ProgramView | null>(null);
const perkCode = ref({ code: '', label: '' });
const actionBusy = ref(false);
const emailReady = nearAuthAvailable();
const linkedEmail = ref<string | null>(localStorage.getItem(EMAIL_KEY));
const protectSettled = ref(!!linkedEmail.value || !!localStorage.getItem(PROTECT_DISMISSED_KEY));

const busy = ref(false);
const detail = ref<{ n: string; closing: boolean } | null>(null);
const dOn = ref(false);
const bgOn = ref(false);
const landed = ref(false);
const pickedIndex = ref(-1);
const navOut = ref(false);
const homeShow = ref(true);
const startTop = ref(0);
const cardHeight = ref(200);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const subscriptions = new Map<string, () => void>();
let pendingJoin: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let wasOffline = false;
let funding = false;

function storedSort(): SortKey {
  const saved = localStorage.getItem(SORT_KEY);
  return SORT_OPTIONS.some(([key]) => key === saved) ? (saved as SortKey) : 'recent';
}

const recovery = useRecovery(async (recovered) => {
  sheet.value = null;
  await boot(recovered);
});

const ordered = computed(() => sortPasses(passes.value, sort.value, programs.value, position.value));
const total = computed(() => formatMoney(totalBalance(passes.value)));
const detailPass = computed(() => (detail.value ? (passes.value.find((pass) => pass.token_id === detail.value!.n) ?? null) : null));
const detailProgram = computed(() => (detailPass.value ? (programs.value[detailPass.value.program_slug] ?? null) : null));
const contentTop = computed(() => CARD_TOP + cardHeight.value + 12);
const nearest = computed(() => {
  const here = position.value;
  if (!here) return null;
  const found = passes.value
    .map((pass) => ({ pass, distance: nearestDistance(programs.value[pass.program_slug], here) }))
    .filter((entry) => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)[0];
  return found ?? null;
});
const offerInstall = computed(() => screen.value === 'home' && sheet.value === null && protectSettled.value && passes.value.length > 0 && !detail.value);

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, reduced ? 0 : ms));

const frame = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(go);
    setTimeout(go, 60);
  });

const topWithinScreen = (element: Element) => element.getBoundingClientRect().top - screenEl.value!.getBoundingClientRect().top;

function measure() {
  cardHeight.value = ((screenEl.value?.clientWidth ?? 360) - 40) / CARD_ASPECT;
}

function positions(): Map<HTMLElement, number> {
  const tops = new Map<HTMLElement, number>();
  listEl.value?.querySelectorAll<HTMLElement>('[data-n]').forEach((element) => tops.set(element, element.getBoundingClientRect().top));
  return tops;
}

function locate(): Promise<void> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      showToast('info', 'Location is not available', 'Cards stay sorted by recent activity.');
      resolve();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (here) => {
        position.value = { lat: here.coords.latitude, lng: here.coords.longitude };
        resolve();
      },
      () => {
        showToast('info', 'Location is off', 'Allow location to sort cards by distance.');
        resolve();
      },
      { timeout: 8000, maximumAge: 300_000 },
    );
  });
}

async function setSort(value: SortKey) {
  sortOpen.value = false;
  if (value === sort.value || busy.value) return;
  if (value === 'nearest' && !position.value) await locate();
  localStorage.setItem(SORT_KEY, value);
  if (reduced) {
    sort.value = value;
    return;
  }
  busy.value = true;
  const first = positions();
  sort.value = value;
  await nextTick();
  const last = positions();
  const moves: Promise<unknown>[] = [];
  let index = 0;
  last.forEach((top, element) => {
    const dy = (first.get(element) ?? top) - top;
    const side = index % 2 === 0 ? 1 : -1;
    index++;
    moves.push(
      element
        .animate(
          [
            { transform: `translateY(${dy}px)` },
            { transform: `translate(${side * 12}px, ${dy * 0.45}px) rotate(${side * 1.5}deg)`, offset: 0.45 },
            { transform: 'none' },
          ],
          { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' },
        )
        .finished.catch(() => undefined),
    );
  });
  await Promise.all(moves);
  busy.value = false;
}

async function loadDetailHistory() {
  const pass = detailPass.value;
  if (!pass) return;
  history.value = await loadHistory(pass.token_id, programs.value[pass.program_slug]).catch(() => []);
}

async function open(pass: PassView, element: HTMLElement) {
  if (busy.value || detail.value) return;
  busy.value = true;
  startTop.value = topWithinScreen(element);
  detail.value = { n: pass.token_id, closing: false };
  landed.value = false;
  pickedIndex.value = ordered.value.findIndex((entry) => entry.token_id === pass.token_id);
  homeShow.value = true;
  history.value = [];
  window.history.pushState({ detail: true }, '', `/wallet/${pass.program_slug}`);
  void loadDetailHistory();
  await nextTick();
  await frame();
  homeShow.value = false;
  dOn.value = true;
  bgOn.value = true;
  navOut.value = true;
  await wait(420);
  busy.value = false;
}

async function settled() {
  for (let attempt = 0; attempt < 40 && busy.value; attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
}

async function close() {
  await settled();
  if (busy.value || !detail.value) return;
  busy.value = true;
  const element = listEl.value?.querySelector<HTMLElement>(`[data-n="${CSS.escape(detail.value.n)}"]`);
  if (element) startTop.value = topWithinScreen(element);
  detail.value = { ...detail.value, closing: true };
  await frame();
  dOn.value = false;
  await wait(90);
  bgOn.value = false;
  homeShow.value = true;
  await wait(200);
  navOut.value = false;
  await wait(230);
  landed.value = true;
  await wait(380);
  detail.value = null;
  busy.value = false;
}

function back() {
  if (window.history.state?.detail) {
    window.history.back();
    return;
  }
  window.history.replaceState(null, '', '/wallet');
  void close();
}

function openWithoutMotion(pass: PassView) {
  detail.value = { n: pass.token_id, closing: false };
  pickedIndex.value = ordered.value.findIndex((entry) => entry.token_id === pass.token_id);
  landed.value = false;
  homeShow.value = false;
  dOn.value = true;
  bgOn.value = true;
  navOut.value = true;
  void loadDetailHistory();
}

function leaveDetail() {
  detail.value = null;
  dOn.value = false;
  bgOn.value = false;
  navOut.value = false;
  homeShow.value = true;
  landed.value = false;
  busy.value = false;
  window.history.replaceState(null, '', '/wallet');
}

function onPopState() {
  const match = window.location.pathname.match(/^\/wallet\/([a-z0-9-]+)$/);
  if (!match && detail.value) void close();
  if (match && !detail.value) {
    const pass = passes.value.find((entry) => entry.program_slug === match[1]);
    if (pass) openWithoutMotion(pass);
  }
}

async function loadPrograms(list: PassView[]) {
  const missing = [...new Set(list.map((pass) => pass.program_slug))].filter((slug) => !programs.value[slug]);
  const fetched = await Promise.all(missing.map((slug) => getProgram(slug).catch(() => null)));
  const next = { ...programs.value };
  for (const program of fetched) if (program) next[program.slug] = program;
  programs.value = next;
}

function announceChanges(previous: PassView[], next: PassView[]) {
  if (!loaded.value) return;
  for (const before of previous) {
    const now = next.find((pass) => pass.token_id === before.token_id);
    if (!now) {
      if (before.listing_price) {
        const price = BigInt(before.listing_price);
        const royalty = (price * BigInt(programs.value[before.program_slug]?.royalty_bps ?? 0)) / 10_000n;
        showToast('success', 'Your card was sold', `${before.program_name} card sold for ${formatMoney(price)}. You received ${formatMoney(price - royalty)}.`);
      }
      continue;
    }
    if (now.purchase_count > before.purchase_count) {
      const earned = BigInt(now.balance) + BigInt(now.pending) - BigInt(before.balance) - BigInt(before.pending);
      showToast('success', `+${formatMoney(earned > 0n ? earned : 0n)} at ${now.program_name}`);
    }
    if (now.tier_index > before.tier_index) setTimeout(() => (levelUp.value = now), 900);
  }
  for (const added of next.filter((pass) => !previous.some((before) => before.token_id === pass.token_id))) {
    if (added.program_slug !== pendingJoin) showToast('success', 'New card', `${added.program_name} is in your wallet.`);
  }
}

function applyWelcome() {
  if (!pendingJoin || !passes.value.some((pass) => pass.program_slug === pendingJoin)) return;
  const welcomed = JSON.parse(localStorage.getItem(WELCOMED_KEY) ?? '[]') as string[];
  if (!welcomed.includes(pendingJoin)) {
    welcome.value = pendingJoin;
    localStorage.setItem(WELCOMED_KEY, JSON.stringify([...welcomed, pendingJoin]));
  }
  pendingJoin = null;
}

function handleConnection(state: ConnectionState) {
  if (state === 'offline') wasOffline = true;
  if (state === 'live' && wasOffline) {
    wasOffline = false;
    scheduleRefresh();
  }
}

function syncSubscriptions() {
  if (!wallet.value) return;
  const wanted = new Set([`account_id:${wallet.value.accountId}`, ...passes.value.map((pass) => `token_id:${pass.token_id}`)]);
  for (const [target, stop] of subscriptions) {
    if (wanted.has(target)) continue;
    stop();
    subscriptions.delete(target);
  }
  for (const target of wanted) {
    if (subscriptions.has(target)) continue;
    const [column, value] = target.split(/:(.+)/) as ['token_id' | 'account_id', string];
    subscriptions.set(target, subscribeToEvents({ column, value, onEvent: scheduleRefresh, onState: handleConnection }));
  }
}

function ensureFunded() {
  if (funding || !wallet.value || passes.value.length === 0) return;
  funding = true;
  fetch('/api/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId: wallet.value.accountId }),
  })
    .then((response) => {
      funding = response.ok;
    })
    .catch(() => {
      funding = false;
    });
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh().catch(() => undefined), 300);
}

async function refresh() {
  if (!wallet.value) return;
  const previous = passes.value;
  const next = await getPassesByOwner(wallet.value.accountId);
  announceChanges(previous, next);
  passes.value = next;
  ensureFunded();
  await loadPrograms(next);
  applyWelcome();
  syncSubscriptions();
  const changed = next.length !== previous.length || next.some((pass) => (previous.find((before) => before.token_id === pass.token_id)?.purchase_count ?? -1) !== pass.purchase_count);
  if (screen.value === 'code' && changed) codeScreen.value?.refreshNow();
  if (detail.value) {
    if (detailPass.value) await loadDetailHistory();
    else leaveDetail();
  }
}

async function boot(active: BrowserWallet) {
  wallet.value = active;
  const params = new URLSearchParams(window.location.search);
  const joined = params.get('joined');
  if (joined) {
    pendingJoin = joined;
    window.history.replaceState(null, '', window.location.pathname);
  }
  await refresh().catch(() => undefined);
  loaded.value = true;
  screen.value = 'home';
  await nextTick();
  measure();
  if (joined && !passes.value.some((pass) => pass.program_slug === joined)) {
    showToast('info', 'Your wallet is ready', 'Show your code at the counter and the cashier issues your card.');
    pendingJoin = null;
  }
  if (joined && passes.value.length > 0 && !protectSettled.value) sheet.value = 'protect';
  else protectSettled.value = true;
  const slug = props.initialSlug ?? window.location.pathname.match(/^\/wallet\/([a-z0-9-]+)$/)?.[1] ?? null;
  const target = slug ? passes.value.find((pass) => pass.program_slug === slug) : null;
  if (target) {
    await nextTick();
    openWithoutMotion(target);
  } else if (slug) {
    window.history.replaceState(null, '', '/wallet');
  }
}

async function openConnectedShortcut(_accountId: string, adopt: (storageName: string) => Promise<BrowserWallet>) {
  await boot(await adopt(CUSTOMER_STORAGE_KEY));
  showToast('success', 'Shortcut connected', 'Your cards are ready.');
}

async function startFresh() {
  await boot(await createWallet());
}

async function downloadBackup() {
  if (!wallet.value || actionBusy.value) return;
  actionBusy.value = true;
  try {
    const secret = await backupKey(wallet.value);
    const blob = new Blob([backupText('Fairly wallet backup', wallet.value.accountId, secret)], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'fairly-wallet-backup.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (cause) {
    showError('back up your wallet', cause);
  } finally {
    actionBusy.value = false;
  }
}

async function protectWithEmail() {
  if (!wallet.value || actionBusy.value) return;
  actionBusy.value = true;
  try {
    const identity = await linkEmail(wallet.value, 'customer');
    linkedEmail.value = identity.email ?? 'your email';
    localStorage.setItem(EMAIL_KEY, linkedEmail.value);
    protectSettled.value = true;
    showToast('success', 'Wallet protected', `You can recover it with ${linkedEmail.value}.`);
  } catch (cause) {
    showToast('error', 'Could not link your email', nearAuthMessage(cause));
  } finally {
    actionBusy.value = false;
  }
}

async function claimLevelPerk() {
  const pass = levelUp.value;
  const program = pass ? programs.value[pass.program_slug] : null;
  if (!pass || !program || !wallet.value || actionBusy.value) return;
  actionBusy.value = true;
  try {
    const code = await claimPerk(wallet.value, pass.token_id, pass.tier_index);
    perkCode.value = { code: redemptionDisplayCode(code), label: program.tiers[pass.tier_index]?.perk ?? 'Perk' };
    levelUp.value = null;
    sheet.value = 'perk';
    await refresh();
  } catch (cause) {
    showError('claim the perk', cause);
  } finally {
    actionBusy.value = false;
  }
}

async function replayIntro() {
  sheet.value = null;
  const first = ordered.value[0];
  introProgram.value = (first && programs.value[first.program_slug]) || (await getProgram(props.demoSlug).catch(() => null));
}

function protectLater() {
  localStorage.setItem(PROTECT_DISMISSED_KEY, '1');
  protectSettled.value = true;
  sheet.value = null;
}

function openCode() {
  if (busy.value) return;
  screen.value = 'code';
}

onMounted(async () => {
  window.addEventListener('popstate', onPopState);
  window.addEventListener('resize', measure);
  measure();
  const existing = await loadWallet();
  if (existing) {
    await boot(existing);
    return;
  }
  if (isStandalone()) {
    screen.value = 'shortcut';
    return;
  }
  await boot(await createWallet());
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState);
  window.removeEventListener('resize', measure);
  clearTimeout(refreshTimer);
  subscriptions.forEach((stop) => stop());
  subscriptions.clear();
});
</script>

<template>
  <div ref="screenEl" class="relative mx-auto h-[calc(100dvh-1.75rem)] max-w-[440px] overflow-hidden bg-cream" :class="busy && 'is-busy'">
    <div v-if="screen === 'loading'" class="grid h-full place-items-center text-ink/50">Loading your wallet…</div>

    <div v-else-if="screen === 'shortcut'" class="flex h-full flex-col overflow-y-auto">
      <ShortcutConnect
        slug="wallet"
        context="customer"
        app-name="Fairly"
        place="wallet"
        skip-label="I do not have a wallet yet"
        @connected="openConnectedShortcut"
        @skip="startFresh"
      >
        <template #alternatives>
          <label class="cursor-pointer underline underline-offset-4">
            Restore from a backup file
            <input type="file" accept=".txt,text/plain" class="hidden" @change="recovery.restoreFromFile" />
          </label>
          <button v-if="emailReady" class="flex items-center gap-2 underline underline-offset-4 disabled:opacity-50" :disabled="recovery.busy.value" @click="recovery.recoverByEmail">
            <BusySpinner v-if="recovery.busy.value" />{{ recovery.busy.value ? 'Waiting for NEAR Auth…' : 'Recover with email' }}
          </button>
        </template>
      </ShortcutConnect>
    </div>

    <template v-else>
      <div class="absolute inset-0 flex flex-col">
        <div class="no-scrollbar flex-1 overflow-y-auto px-5 pt-8 pb-32">
          <header class="hi flex items-center justify-between" style="--h: 0" :class="detail && !homeShow && 'hi-off'">
            <div class="flex items-center gap-3">
              <span class="grid size-11 place-items-center rounded-full bg-lilac"><AppIcon name="wallet" class="size-5" /></span>
              <div>
                <p class="text-xs text-ink/55">Fairly</p>
                <h1 class="text-lg leading-tight font-bold">Your wallet</h1>
              </div>
            </div>
            <button class="grid size-11 place-items-center rounded-full bg-white font-bold shadow-soft" aria-label="How it works" @click="sheet = 'help'">?</button>
          </header>

          <div v-if="welcome" class="hi mt-5 flex animate-pop items-center gap-3 rounded-xl2 bg-mint p-4" style="--h: 1" :class="detail && !homeShow && 'hi-off'">
            <span class="grid size-11 place-items-center rounded-full bg-ink text-mint"><AppIcon name="check" class="size-5" /></span>
            <div>
              <p class="leading-tight font-bold">Card added</p>
              <p class="text-sm text-ink/70">{{ passes.find((pass) => pass.program_slug === welcome)?.program_name }} is in your wallet. Show your code at the counter.</p>
            </div>
          </div>

          <div v-if="passes.length" class="hi mt-5 flex items-center gap-3 rounded-xl2 bg-white p-3 shadow-soft" style="--h: 1" :class="detail && !homeShow && 'hi-off'">
            <span class="grid size-10 place-items-center rounded-full bg-coral-soft text-coral"><AppIcon :name="nearest ? 'pin' : 'wallet'" class="size-5" /></span>
            <div class="flex-1">
              <template v-if="sort === 'nearest' && nearest">
                <p class="text-xs text-ink/55">Nearest to you</p>
                <p class="leading-tight font-bold">{{ nearest.pass.program_name }} · {{ formatDistance(nearest.distance) }}</p>
              </template>
              <template v-else>
                <p class="text-xs text-ink/55">Total balance</p>
                <p class="leading-tight font-bold tabular-nums">{{ total }}</p>
              </template>
            </div>
            <span class="text-sm font-semibold text-ink/50">{{ passes.length }} {{ passes.length === 1 ? 'card' : 'cards' }}</span>
          </div>

          <div v-if="passes.length" class="hi mt-6 flex items-center justify-between" style="--h: 2" :class="detail && !homeShow && 'hi-off'">
            <h2 class="text-xl font-bold">Cards</h2>
            <div v-if="passes.length > 1" class="relative w-44">
              <button
                class="flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3 text-sm font-semibold text-ink transition"
                :class="sortOpen ? 'border-ink' : 'border-ink/10 hover:border-ink/40'"
                :aria-expanded="sortOpen"
                aria-label="Sort cards"
                @click="sortOpen = !sortOpen"
              >
                <span>{{ SORT_OPTIONS.find(([key]) => key === sort)?.[1] }}</span>
                <AppIcon name="chevron" class="size-4 transition" :class="sortOpen && 'rotate-180'" />
              </button>
              <SortMenu v-if="sortOpen" :options="SORT_OPTIONS" :selected="sort" @pick="setSort" @close="sortOpen = false" />
            </div>
          </div>

          <div v-if="passes.length" ref="listEl" class="mt-3 pb-3">
            <div
              v-for="(pass, index) in ordered"
              :key="pass.token_id"
              :data-n="pass.token_id"
              class="stk relative cursor-pointer"
              role="button"
              tabindex="0"
              :aria-label="`Open ${pass.program_name} card`"
              :class="detail && (detail.n === pass.token_id ? (landed ? 'is-landed' : 'is-picked') : !homeShow ? 'hi-off' : '')"
              :style="{
                '--h': detail && detail.closing && index > pickedIndex ? 12 + index - pickedIndex : index + 3,
                zIndex: index + 1,
                height: index === ordered.length - 1 ? 'auto' : `${STACK_STEP}px`,
              }"
              @click="open(pass, $event.currentTarget as HTMLElement)"
              @keydown.enter="open(pass, $event.currentTarget as HTMLElement)"
            >
              <div class="stk-art rounded-[20px]">
                <img :src="cardArtUrl(pass)" :alt="`${pass.program_name} ${pass.tier_name} card`" class="block w-full rounded-[20px]" />
              </div>
              <span
                v-if="index < ordered.length - 1"
                class="absolute top-[14px] right-3 flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold tabular-nums"
                :class="welcome === pass.program_slug ? 'bg-coral text-ink' : 'bg-ink text-white'"
              >
                <template v-if="welcome === pass.program_slug">New</template>
                <template v-else>
                  <AppIcon name="star" class="size-3" :style="{ color: TIER_COLORS[pass.tier_index] ?? '#FFC23D' }" />{{ formatMoney(pass.balance) }}
                  <span v-if="pass.pending !== '0'" class="font-semibold text-sun" data-testid="stack-pending">+{{ formatMoney(pass.pending) }} pending</span>
                </template>
              </span>
            </div>
          </div>

          <div v-else-if="loaded" class="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div class="relative h-44 w-56">
              <div class="absolute inset-x-2 top-4 aspect-[1.6] -rotate-[8deg] rounded-[20px] border-2 border-dashed border-ink/20" />
              <div class="absolute inset-x-2 top-8 aspect-[1.6] rotate-[5deg] rounded-[20px] border-2 border-dashed border-ink/30 bg-cream" />
              <span class="absolute top-0 -left-2 grid size-12 place-items-center rounded-full bg-gold text-xl font-extrabold">$</span>
              <span class="absolute right-0 bottom-0 grid size-9 place-items-center rounded-full bg-sun font-extrabold">$</span>
            </div>
            <h2 class="mt-6 text-3xl leading-none font-extrabold tracking-tight">No cards yet</h2>
            <p class="mt-2 text-ink/65">Scan the Fairly QR at your favorite shop. The card lands here.</p>
            <a href="/market" class="mt-8 flex h-14 w-full items-center justify-between rounded-full bg-ink pr-2 pl-7 font-semibold text-white">
              <span>Browse the market</span>
              <span class="grid size-10 place-items-center rounded-full bg-sun text-ink"><AppIcon name="arrow" class="size-5" /></span>
            </a>
          </div>
        </div>

        <div v-if="detail" class="absolute inset-0 z-30" :class="dOn && 'in'">
          <div class="fade-d absolute inset-0 bg-cream" :style="{ opacity: bgOn ? 1 : 0 }" />
          <header class="ei absolute inset-x-5 top-8 flex items-center justify-between" style="--i: 0">
            <button class="grid size-11 place-items-center rounded-full bg-white shadow-soft" aria-label="Back to wallet" @click="back">
              <AppIcon name="back" class="size-5" />
            </button>
            <p class="font-bold">{{ detailPass?.program_name }}</p>
            <span class="size-11" />
          </header>
          <div
            v-if="detailPass"
            class="lift absolute inset-x-5"
            :class="detail.closing && 'lift-back'"
            :style="{ top: `${CARD_TOP}px`, transform: `translateY(${dOn ? 0 : startTop - CARD_TOP}px)`, opacity: landed ? 0 : 1 }"
          >
            <img :src="cardArtUrl(detailPass)" :alt="`${detailPass.program_name} ${detailPass.tier_name} card`" class="block w-full rounded-[20px] shadow-card" />
          </div>
          <div v-if="detailPass && detailProgram && wallet" class="no-scrollbar absolute inset-x-5 bottom-6 overflow-y-auto" :style="{ top: `${contentTop}px` }">
            <CardDetail
              :pass="detailPass"
              :program="detailProgram"
              :wallet="wallet"
              :history="history"
              :other-cards="passes.length - 1"
              :is-demo="detailPass.program_slug === demoSlug"
              @changed="refresh().catch(() => undefined)"
              @backup="downloadBackup"
            />
          </div>
        </div>

        <nav
          class="navx absolute inset-x-0 bottom-0 z-40 grid h-24 grid-cols-5 items-center rounded-t-xl3 bg-white text-ink/40 shadow-[0_-10px_30px_-15px_rgba(0,0,0,.2)]"
          :class="navOut && 'nav-out'"
          aria-label="Wallet"
        >
          <button class="grid place-items-center text-ink" aria-label="Cards" @click="detail ? back() : undefined"><AppIcon name="wallet" class="size-6" /></button>
          <a class="grid place-items-center" aria-label="Market" href="/market"><AppIcon name="list" class="size-6" /></a>
          <button class="grid place-items-center" aria-label="Show my code" @click="openCode">
            <span class="-mt-10 grid size-16 place-items-center rounded-full bg-coral text-ink shadow-card ring-8 ring-cream"><AppIcon name="qr" class="size-7" /></span>
          </button>
          <button class="grid place-items-center" aria-label="Back up wallet" :disabled="actionBusy" @click="downloadBackup">
            <BusySpinner v-if="actionBusy" /><AppIcon v-else name="download" class="size-6" />
          </button>
          <button class="grid place-items-center" aria-label="Help" @click="sheet = 'help'"><AppIcon name="settings" class="size-6" /></button>
        </nav>
      </div>

      <div v-if="introProgram" class="absolute inset-0 z-[75]">
        <IntroSlides :program="introProgram" :pass="ordered[0] ?? null" @done="introProgram = null" />
      </div>

      <div v-if="levelUp" class="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-gold px-8 text-center" role="dialog" aria-label="Level up">
        <div class="grid size-32 animate-pop place-items-center rounded-full bg-white/40"><AppIcon :name="PERK_ICONS[levelUp.tier_index] ?? 'star'" class="size-16" /></div>
        <p class="mt-8 text-lg font-semibold">You reached</p>
        <p class="text-6xl font-extrabold tracking-tight">{{ levelUp.tier_name }}</p>
        <p class="mt-1 text-sm font-semibold">at {{ levelUp.program_name }}</p>
        <p v-if="programs[levelUp.program_slug]?.tiers[levelUp.tier_index]?.perk" class="mt-4 text-lg">Unlocked: <b>{{ programs[levelUp.program_slug]?.tiers[levelUp.tier_index]?.perk }}</b></p>
        <button
          v-if="programs[levelUp.program_slug]?.tiers[levelUp.tier_index]?.perk"
          class="mt-10 flex h-14 items-center gap-3 rounded-full bg-ink px-10 font-semibold text-white disabled:opacity-60"
          :disabled="actionBusy"
          @click="claimLevelPerk"
        >
          <BusySpinner v-if="actionBusy" />Claim perk
        </button>
        <button class="mt-3 h-12 px-6 font-semibold" @click="levelUp = null">Later</button>
      </div>

      <CodeScreen v-if="screen === 'code' && wallet" ref="codeScreen" :wallet="wallet" @back="screen = 'home'" />
    </template>

    <BottomSheet :open="sheet !== null" @close="sheet = null">
      <div v-if="sheet === 'help'">
        <h3 class="text-3xl font-extrabold tracking-tight">How it works</h3>
        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl2 bg-coral-soft p-4"><AppIcon name="qr" class="size-7" /><p class="mt-3 font-bold">Show code</p><p class="text-ink/60">when you pay</p></div>
          <div class="rounded-xl2 bg-sun-soft p-4"><AppIcon name="cup" class="size-7" /><p class="mt-3 font-bold">Earn cashback</p><p class="text-ink/60">on every visit</p></div>
          <div class="rounded-xl2 bg-lilac-soft p-4"><AppIcon name="star" class="size-7" /><p class="mt-3 font-bold">Level up</p><p class="text-ink/60">unlock perks</p></div>
          <div class="rounded-xl2 bg-mint-soft p-4"><AppIcon name="tag" class="size-7" /><p class="mt-3 font-bold">Spend or sell</p><p class="text-ink/60">value stays inside</p></div>
        </div>
        <button class="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-white disabled:opacity-60" :disabled="actionBusy" @click="downloadBackup">
          <BusySpinner v-if="actionBusy" /><AppIcon v-else name="download" class="size-5" /> {{ actionBusy ? 'Preparing your backup…' : 'Back up my wallet' }}
        </button>
        <button v-if="emailReady && !linkedEmail" class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold shadow-soft" @click="sheet = 'protect'">
          <AppIcon name="users" class="size-5" /> Protect my wallet with email
        </button>
        <p v-else-if="linkedEmail" class="mt-2 text-center text-sm text-ink/60">Linked to {{ linkedEmail }}. You can recover this wallet on a new phone.</p>
        <p v-else class="mt-2 text-center text-xs text-ink/50">Email recovery with NEAR Auth works in the local build; the hosted demo is waiting for approval.</p>
        <button
          v-if="installModeNow !== 'none'"
          class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold shadow-soft"
          @click="sheet = null; installPrompt?.open()"
        >
          <AppIcon name="addSquare" class="size-5" /> Add Fairly to home screen
        </button>
        <button class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold shadow-soft" @click="sheet = 'connect'">
          <AppIcon name="tablet" class="size-5" /> Connect home screen app
        </button>
        <a v-if="wallet" :href="accountUrl(wallet.accountId)" target="_blank" rel="noopener" class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold shadow-soft">
          <AppIcon name="link" class="size-5" /> View on NEAR explorer
        </a>
        <button class="mt-2 h-12 w-full rounded-full font-semibold" @click="replayIntro">Replay intro</button>
      </div>

      <div v-else-if="sheet === 'protect'" class="text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-mint"><AppIcon :name="linkedEmail ? 'check' : 'users'" class="size-8" /></span>
        <h3 class="mt-4 text-3xl font-extrabold tracking-tight">{{ linkedEmail ? 'Your wallet is protected' : 'Keep your wallet safe' }}</h3>
        <p class="mt-2 text-ink/60">
          {{
            linkedEmail
              ? `If you lose this phone or clear the browser, sign in with ${linkedEmail} to get your cards back.`
              : 'Your cards live in this browser. Link an email so you can get them back on a new phone, with their balances and levels.'
          }}
        </p>
        <template v-if="!linkedEmail">
          <button v-if="emailReady" class="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink font-semibold text-white disabled:opacity-50" :disabled="actionBusy" @click="protectWithEmail">
            <BusySpinner v-if="actionBusy" />{{ actionBusy ? 'Waiting for NEAR Auth…' : 'Protect with email' }}
          </button>
          <button v-else class="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-white disabled:opacity-60" :disabled="actionBusy" @click="downloadBackup">
            <BusySpinner v-if="actionBusy" /><AppIcon v-else name="download" class="size-5" /> {{ actionBusy ? 'Preparing your backup…' : 'Save a backup file' }}
          </button>
          <p class="mt-3 text-xs text-ink/50">Your email stays with NEAR Auth. Fairly never stores it.</p>
          <button class="mt-2 h-12 w-full rounded-full font-semibold" @click="protectLater">Later</button>
          <p class="text-xs text-ink/50">You can do it any time from the <b>?</b> button at the top.</p>
        </template>
        <button v-else class="mt-6 h-14 w-full rounded-full bg-ink font-semibold text-white" @click="sheet = null">Done</button>
      </div>

      <div v-else-if="sheet === 'perk'" class="text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-mint"><AppIcon name="check" class="size-8" /></span>
        <p class="mt-4 text-ink/60">Tell the cashier this code</p>
        <p class="mt-1 text-5xl font-extrabold tracking-[.15em]">{{ perkCode.code }}</p>
        <p class="mt-2 font-semibold">{{ perkCode.label }}</p>
        <button class="mt-6 h-14 w-full rounded-full bg-ink font-semibold text-white" @click="sheet = null">Done</button>
      </div>

      <div v-else-if="sheet === 'connect'" class="text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-sky"><AppIcon name="tablet" class="size-8" /></span>
        <h3 class="mt-4 text-3xl font-extrabold tracking-tight">Connect home screen app</h3>
        <p class="mt-2 text-ink/60">Open the Fairly shortcut on your home screen. It shows a code. Type it here to let that app use your wallet.</p>
        <div class="mt-5"><ShortcutCodeEntry slug="wallet" :wallet="wallet" @done="sheet = null" /></div>
        <button class="mt-3 h-12 w-full rounded-full font-semibold" @click="sheet = 'help'">Back</button>
      </div>
    </BottomSheet>

    <BottomSheet :open="recovery.pending.value !== null" @close="recovery.cancelRecovery()">
      <div v-if="recovery.pending.value" class="text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-mint"><AppIcon name="check" class="size-8" /></span>
        <h3 class="mt-4 text-3xl font-extrabold tracking-tight">Wallet found</h3>
        <p class="mt-2 text-ink/60">
          Signed in{{ recovery.pending.value.email ? ` as ${recovery.pending.value.email}` : '' }}. One more step: approve adding this browser to your wallet. NEAR Auth opens again to confirm.
        </p>
        <button class="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink font-semibold text-white disabled:opacity-50" :disabled="recovery.busy.value" @click="recovery.approveRecovery">
          <BusySpinner v-if="recovery.busy.value" />{{ recovery.busy.value ? 'Recovering your wallet…' : 'Approve with NEAR Auth' }}
        </button>
        <button class="mt-2 h-12 w-full rounded-full font-semibold" :disabled="recovery.busy.value" @click="recovery.cancelRecovery()">Cancel</button>
      </div>
    </BottomSheet>

    <InstallPrompt ref="installPrompt" context="wallet" app-name="Fairly" :connect-note="connectNote" :auto="offerInstall" raised />
    <ToastStack />
  </div>
</template>
