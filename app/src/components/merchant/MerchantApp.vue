<script setup lang="ts">
import ToastStack from '../ui/ToastStack.vue';
import InstallPrompt from '../ui/InstallPrompt.vue';
import ShortcutCodeEntry from '../ui/ShortcutCodeEntry.vue';
import ShortcutConnect from '../ui/ShortcutConnect.vue';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import InfoTip from '../ui/InfoTip.vue';
import LocationPicker from '../ui/LocationPicker.vue';
import MapView from '../ui/MapView.vue';
import DateRangePicker, { type DateRange } from '../ui/DateRangePicker.vue';
import QrCode from '../ui/QrCode.vue';
import SelectMenu from '../ui/SelectMenu.vue';
import SideDrawer from '../ui/SideDrawer.vue';
import TablePager from '../ui/TablePager.vue';
import BoostsView from './BoostsView.vue';
import SalesChart from './SalesChart.vue';
import SetupWizard from './SetupWizard.vue';
import { getPass, getProgram } from '../../lib/near';
import { slugify } from '../../lib/business-types';
import { backupText } from '../../lib/browser-wallet';
import { cardCodeOf, dollarsToBaseUnits, formatMoney, formatPercent, readableTextColor } from '../../lib/format';
import {
  actionError,
  demoActions,
  loadMerchant,
  MERCHANT_STORAGE_KEY,
  merchantBackupKey,
  loadManager,
  managerActions,
  ownerActions,
  readOnlyActions,
  type MerchantActions,
} from '../../lib/merchant-actions';
import { shortAddress, type Place } from '../../lib/geocoding';
import { lookupPairing, pairingStorageKey } from '../../lib/pairing';
import { installModeNow, isStandalone } from '../../lib/install';
import type { BrowserWallet } from '../../lib/browser-wallet';
import { linkEmail, nearAuthAvailable, nearAuthMessage } from '../../lib/near-auth';
import { offsetLabel } from '../../lib/timezone';
import { showToast, type ToastKind } from '../../lib/toast';
import BusySpinner from '../ui/BusySpinner.vue';
import type { IconName } from '../../lib/icons';
import {
  change,
  dailyCashback,
  lastDays,
  overview,
  periodBetween,
  previousPeriod,
  oldestPendingAt,
  purchasesOf,
  resalesOf,
  runway,
  SETTLEMENT_DAYS,
  type RangeDays,
} from '../../lib/merchant-stats';
import { programEvents, subscribeToEvents, type ConnectionState, type FairlyEvent } from '../../lib/realtime';
import type { PassView, ProgramView } from '../../lib/types';

type View = 'overview' | 'customers' | 'boosts' | 'funds' | 'locations' | 'devices' | 'join' | 'setup' | 'settings';
type Drawer = { kind: 'customer'; tokenId: string } | { kind: 'device'; accountId: string } | null;

const props = defineProps<{ initialProgram: ProgramView; joinUrl: string; isDemo: boolean }>();

const NAV: [View, string, IconName][] = [
  ['overview', 'Overview', 'chart'],
  ['customers', 'Customers', 'users'],
  ['boosts', 'Boosts', 'calendar'],
  ['locations', 'Locations', 'pin'],
  ['devices', 'Counter devices', 'tablet'],
  ['funds', 'Cashback pool', 'wallet'],
  ['join', 'Join QR', 'qr'],
  ['setup', 'Brand and rewards', 'star'],
  ['settings', 'Settings', 'settings'],
];
const TIER_COLORS = ['#E8894F', '#AEB9C6', '#FFC23D', '#17161A'];
const PAGE_SIZE = 6;
const ACTIVITY_PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 8;
const SIDEBAR_KEY = 'fairly.business.sidebar';
const FUND_OPTIONS = [25, 50, 100];

const TIPS = {
  cashback:
    "Money you added to customers' cards in this period. It comes out of your cashback pool and customers spend it here on later visits.",
  royalty:
    'Your share each time one of your cards is resold on the market. It is paid to you automatically, apart from the cashback you give.',
  pool: 'Money you set aside for cashback. Each purchase moves a small part of it onto the customer card. You can add or withdraw it at any time.',
  pending:
    'Cashback earned above your pool. It waits on the cards as Pending and becomes Available automatically when you settle, so customers never lose it.',
  held: 'Cashback already on customer cards that has not been spent yet. Customers can use it at your counter.',
  return: 'Member sales for every $1.00 of cashback given. Higher means each dollar of cashback brings more sales.',
};

const program = shallowRef<ProgramView>(props.initialProgram);
const events = ref<FairlyEvent[]>([]);
const passes = ref<PassView[]>([]);
const view = ref<View>('overview');
const range = ref<RangeDays>(30);
const customRange = ref<DateRange | null>(null);
const compare = ref(false);
const collapsed = ref(false);
const drawer = ref<Drawer>(null);
const historyPage = ref(0);
const locationForm = ref<{ id: string | null; name: string; place: Place | null } | null>(null);
const savingLocation = ref(false);
const locationError = ref('');
const actions = shallowRef<MerchantActions>(readOnlyActions());
const isOwner = ref(false);
const signerWallet = shallowRef<BrowserWallet | null>(null);
const connectScreen = ref(false);
const installPrompt = ref<InstanceType<typeof InstallPrompt> | null>(null);
const installContext = `dashboard:${props.initialProgram.slug}`;
const connectNote = 'On iPhone the home screen app starts empty. You connect it once with a code: open the dashboard in Safari, go to Settings and choose Connect home screen app.';
const managerAccount = ref<string | null>(null);
const invite = ref<{ locationId: string | null; code: string; busy: boolean; error: string } | null>(null);
const removingManager = ref<string | null>(null);
const launched = ref(false);
const withdrawDollars = ref<number | null>(null);
const withdrawing = ref(false);
const pausing = ref(false);
const revoking = ref<string | null>(null);
const pairing = ref<{ locationId: string; code: string; busy: boolean; error: string } | null>(null);
const origin = typeof window === 'undefined' ? '' : window.location.origin;
const locationFilter = ref<string>('');
const activityPage = ref(0);
const customerPage = ref(0);
const search = ref('');
const connection = ref<ConnectionState>('connecting');
const loading = ref(true);
const funding = ref(false);
const settling = ref(false);
const freshIds = ref(new Set<number>());
let unsubscribe = () => {};

const brand = computed(() => program.value.brand_color);
const brandInk = computed(() => readableTextColor(brand.value));
const purchases = computed(() => purchasesOf(events.value));
const resales = computed(() => resalesOf(events.value));
const period = computed(() => (customRange.value ? periodBetween(customRange.value.from, customRange.value.to) : lastDays(range.value)));
const periodLabel = computed(() => (customRange.value ? `${period.value.days} days` : `last ${range.value} days`));
const stats = computed(() => overview(purchases.value, resales.value, period.value, locationFilter.value || null));
const previousStats = computed(() =>
  compare.value ? overview(purchases.value, resales.value, previousPeriod(period.value), locationFilter.value || null) : null,
);
const locationOptions = computed(() => [
  { value: '', label: 'All locations' },
  ...program.value.locations.map((location) => ({ value: location.id, label: location.name })),
]);
const locationName = (id: string) => program.value.locations.find((location) => location.id === id)?.name ?? id;
const filterLabel = computed(() => (locationFilter.value ? locationName(locationFilter.value) : 'All locations'));
const pool = computed(() => Number(program.value.pool_balance));
const perDay = computed(() => dailyCashback(purchases.value));
const poolRunway = computed(() => runway(pool.value, perDay.value));
const pendingTotal = computed(() => BigInt(program.value.pending_total));
const pendingSince = computed(() => {
  if (pendingTotal.value === 0n) return null;
  const tokens = new Set(passes.value.filter((pass) => pass.pending !== '0').map((pass) => pass.token_id));
  return oldestPendingAt(events.value, tokens);
});
const pendingDays = computed(() => (pendingSince.value === null ? 0 : Math.floor((Date.now() - pendingSince.value) / 86_400_000)));
const settlementOverdue = computed(() => pendingTotal.value > 0n && pendingDays.value >= SETTLEMENT_DAYS);
const pendingCards = computed(() => passes.value.filter((pass) => pass.pending !== '0').length);
const canSettle = computed(() => isOwner.value || props.isDemo);
const runwayColor = computed(() => ({ ok: '#1F9D6B', low: '#D97706', empty: '#DC2626' })[poolRunway.value.level]);
const returnOnCashback = computed(() =>
  stats.value.cashback > 0 ? stats.value.salesCents / 100 / (stats.value.cashback / 1_000_000) : 0,
);

const activity = computed(() => {
  const rows = [
    ...purchases.value
      .filter((purchase) => !locationFilter.value || purchase.locationId === locationFilter.value)
      .map((purchase) => ({
        id: purchase.id,
        at: purchase.at,
        card: cardCodeOf(purchase.tokenId),
        place: locationName(purchase.locationId),
        item: purchase.category ?? 'Other',
        amount: formatMoney(String(purchase.cents * 10_000)),
        result: purchase.pending > 0 ? `+${formatMoney(String(purchase.cashback))} pending` : `+${formatMoney(String(purchase.cashback))}`,
        kind: 'cashback' as const,
      })),
    ...resales.value.map((resale) => ({
      id: resale.id,
      at: resale.at,
      card: cardCodeOf(resale.tokenId),
      place: 'Market',
      item: 'Card resold',
      amount: formatMoney(String(resale.price)),
      result: `+${formatMoney(String(resale.royalty))}`,
      kind: 'royalty' as const,
    })),
  ];
  return rows.sort((a, b) => b.at - a.at);
});
const activityRows = computed(() =>
  activity.value.slice(activityPage.value * ACTIVITY_PAGE_SIZE, (activityPage.value + 1) * ACTIVITY_PAGE_SIZE),
);

const lastVisit = computed(() => {
  const visits = new Map<string, { at: number; locationId: string }>();
  for (const purchase of purchases.value) visits.set(purchase.tokenId, { at: purchase.at, locationId: purchase.locationId });
  return visits;
});
const customers = computed(() => {
  const query = search.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return passes.value
    .filter((pass) => !query || pass.token_id.split(':')[1]?.includes(query))
    .sort((a, b) => (lastVisit.value.get(b.token_id)?.at ?? 0) - (lastVisit.value.get(a.token_id)?.at ?? 0));
});
const customerRows = computed(() =>
  customers.value.slice(customerPage.value * PAGE_SIZE, customerPage.value * PAGE_SIZE + PAGE_SIZE),
);
const topTier = computed(() => program.value.tiers.length - 1);

interface HistoryEntry {
  id: number;
  at: number;
  title: string;
  detail: string;
  amount: string;
  positive: boolean;
}

function historyEntry(event: FairlyEvent): HistoryEntry | null {
  const at = new Date(event.created_at).getTime();
  const data = event.data;
  const money = (value: unknown) => formatMoney(String(value ?? 0));
  switch (event.event) {
    case 'purchase':
      return {
        id: event.id,
        at,
        title: `Bought ${formatMoney(String(Number(data.amount_cents) * 10_000))}`,
        detail: `${locationName(String(data.location_id))}${data.category ? ` · ${data.category}` : ''}`,
        amount: `+${money(Number(data.credited) + Number(data.pending))}`,
        positive: true,
      };
    case 'redeem':
      return { id: event.id, at, title: 'Used balance', detail: 'Balance code at the counter', amount: `−${money(data.amount)}`, positive: false };
    case 'perk_claimed':
      return { id: event.id, at, title: 'Claimed perk', detail: String(data.perk ?? ''), amount: '', positive: true };
    case 'tier_up':
      return { id: event.id, at, title: `Reached ${String(data.tier_name)}`, detail: 'New level', amount: '', positive: true };
    case 'pending_settled':
      return { id: event.id, at, title: 'Pending cashback landed', detail: 'After settlement', amount: `+${money(data.amount)}`, positive: true };
    case 'sale':
      return { id: event.id, at, title: 'Card resold', detail: `Your royalty ${money(data.royalty)}`, amount: money(data.price), positive: true };
    case 'pass_issued':
      return { id: event.id, at, title: 'Card issued', detail: 'Joined the program', amount: '', positive: true };
    default:
      return null;
  }
}

const drawerPass = computed(() =>
  drawer.value?.kind === 'customer' ? passes.value.find((pass) => pass.token_id === (drawer.value as { tokenId: string }).tokenId) ?? null : null,
);
const drawerDevice = computed(() =>
  drawer.value?.kind === 'device'
    ? deviceRows.value.find((device) => device.account_id === (drawer.value as { accountId: string }).accountId) ?? null
    : null,
);
const drawerHistory = computed<HistoryEntry[]>(() => {
  const current = drawer.value;
  if (!current) return [];
  const matches =
    current.kind === 'customer'
      ? events.value.filter((event) => event.token_id === current.tokenId)
      : events.value.filter((event) => event.signer_id === current.accountId && event.event === 'purchase');
  return matches
    .map(historyEntry)
    .filter((entry): entry is HistoryEntry => entry !== null)
    .map((entry) =>
      current.kind === 'device'
        ? { ...entry, detail: `Card ${cardCodeOf(String(events.value.find((event) => event.id === entry.id)?.token_id))}` }
        : entry,
    )
    .reverse();
});
const drawerHistoryRows = computed(() =>
  drawerHistory.value.slice(historyPage.value * HISTORY_PAGE_SIZE, (historyPage.value + 1) * HISTORY_PAGE_SIZE),
);
const deviceStats = computed(() => {
  const accountId = drawerDevice.value?.account_id;
  const own = purchases.value.filter((purchase) => purchase.signerId === accountId);
  const today = own.filter((purchase) => purchase.at >= lastDays(1).from);
  return {
    todayCount: today.length,
    todayCashback: today.reduce((sum, purchase) => sum + purchase.cashback, 0),
    total: own.length,
    lastUsed: own.at(-1)?.at,
  };
});
const devicesAt = (locationId: string) => program.value.cashiers.filter((cashier) => cashier.location_id === locationId).length;
const locationPins = computed(() =>
  program.value.locations.map((location) => ({ id: location.id, label: location.name, lat: location.lat, lng: location.lng })),
);
const isManager = computed(() => !!managerAccount.value && program.value.managers.some((manager) => manager.account_id === managerAccount.value));
const managedLocation = computed(() =>
  isManager.value ? program.value.managers.find((manager) => manager.account_id === managerAccount.value)?.location_id ?? null : null,
);
const canManageDevicesAt = (locationId: string) => isOwner.value || (isManager.value && (!managedLocation.value || managedLocation.value === locationId));
const manageableLocations = computed(() => program.value.locations.filter((location) => canManageDevicesAt(location.id)));
const deviceRows = computed(() => {
  const active = program.value.cashiers.map((cashier) => ({ ...cashier, active: true }));
  const inactive = new Map<string, string>();
  for (const event of events.value) {
    const account = String(event.data.account_id ?? '');
    if (event.event === 'cashier_added') inactive.set(account, String(event.data.location_id ?? ''));
  }
  return [
    ...active,
    ...[...inactive.entries()]
      .filter(([account]) => !program.value.cashiers.some((cashier) => cashier.account_id === account))
      .map(([account_id, location_id]) => ({ account_id, location_id, active: false })),
  ];
});
const deviceUse = (accountId: string) => {
  const own = purchases.value.filter((purchase) => purchase.signerId === accountId);
  return { today: own.filter((purchase) => purchase.at >= lastDays(1).from).length, last: own.at(-1)?.at };
};

function openDrawer(next: NonNullable<Drawer>) {
  drawer.value = next;
  historyPage.value = 0;
}

function selectRange(days: RangeDays) {
  range.value = days;
  customRange.value = null;
  activityPage.value = 0;
}

function toggleSidebar() {
  collapsed.value = !collapsed.value;
  localStorage.setItem(SIDEBAR_KEY, collapsed.value ? 'collapsed' : 'open');
}

const changeLabel = (current: number, previous: number | undefined) => {
  if (previous === undefined) return '';
  const delta = change(current, previous);
  if (delta === null) return current > 0 ? 'New vs previous' : 'Same as previous';
  return `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta * 100))}% vs previous`;
};

async function saveLocation() {
  const form = locationForm.value;
  if (!form?.place) return;
  savingLocation.value = true;
  locationError.value = '';
  try {
    const location = {
      id: form.id ?? (slugify(form.name) || `location-${program.value.locations.length + 1}`),
      name: form.name.trim(),
      address: shortAddress(form.place.address).slice(0, 160),
      lat: form.place.lat,
      lng: form.place.lng,
    };
    if (form.id) await actions.value.updateLocation(location);
    else await actions.value.addLocation(location);
    await refreshProgram();
    showNotice(`${form.name.trim()} ${form.id ? 'updated' : 'added'}`);
    locationForm.value = null;
  } catch (cause) {
    locationError.value = actionError(cause);
  } finally {
    savingLocation.value = false;
  }
}

async function runAction(task: () => Promise<void>, success: string) {
  try {
    await task();
    await refreshProgram();
    showNotice(success);
    return true;
  } catch (cause) {
    showToast('error', 'Could not save the change', actionError(cause));
    return false;
  }
}

async function withdraw() {
  const dollars = withdrawDollars.value ?? 0;
  if (dollars <= 0) return;
  withdrawing.value = true;
  const done = await runAction(() => actions.value.withdraw(dollarsToBaseUnits(dollars)), `Withdrew ${formatMoney(dollarsToBaseUnits(dollars))} to your account`);
  withdrawing.value = false;
  if (done) withdrawDollars.value = null;
}

async function togglePause() {
  pausing.value = true;
  const paused = !program.value.paused;
  await runAction(() => actions.value.setPaused(paused), paused ? 'Program paused' : 'Program running again');
  pausing.value = false;
}

async function openConnectedShortcut(accountId: string, adopt: (storageName: string) => Promise<BrowserWallet>) {
  const slug = program.value.slug;
  const storageName =
    accountId === program.value.owner
      ? MERCHANT_STORAGE_KEY
      : program.value.managers.some((entry) => entry.account_id === accountId)
        ? pairingStorageKey('manager', slug)
        : null;
  if (!storageName) {
    showToast('error', 'Could not connect the shortcut', 'That account is not the owner or a manager of this business.');
    return;
  }
  await adopt(storageName);
  window.location.reload();
}

async function connectDevice() {
  const form = pairing.value;
  if (!form) return;
  form.busy = true;
  form.error = '';
  try {
    const request = await lookupPairing(program.value.slug, form.code);
    if (request.kind !== 'device') throw new Error('PAIRING_NOT_FOUND');
    await actions.value.addDevice(request.accountId, form.locationId);
    await refreshProgram();
    showNotice(`Device connected at ${locationName(form.locationId)}`);
    pairing.value = null;
  } catch (cause) {
    form.error = actionError(cause);
  } finally {
    form.busy = false;
  }
}

async function revokeDevice(accountId: string) {
  revoking.value = accountId;
  await runAction(() => actions.value.removeDevice(accountId), 'Device paused. It cannot add purchases until you reactivate it.');
  revoking.value = null;
}

async function reactivateDevice(accountId: string, locationId: string) {
  revoking.value = accountId;
  await runAction(() => actions.value.reactivateDevice(accountId, locationId), 'Device active again');
  revoking.value = null;
}

function editLocation(locationId: string) {
  const location = program.value.locations.find((entry) => entry.id === locationId);
  if (!location) return;
  locationError.value = '';
  locationForm.value = {
    id: location.id,
    name: location.name,
    place: location.lat || location.lng ? { address: location.address, lat: location.lat, lng: location.lng } : null,
  };
}

async function inviteManager() {
  const form = invite.value;
  if (!form) return;
  form.busy = true;
  form.error = '';
  try {
    const request = await lookupPairing(program.value.slug, form.code);
    if (request.kind !== 'manager') throw new Error('PAIRING_NOT_FOUND');
    await actions.value.addManager(request.accountId, form.locationId);
    await refreshProgram();
    showNotice('Manager added');
    invite.value = null;
  } catch (cause) {
    form.error = actionError(cause);
  } finally {
    form.busy = false;
  }
}

async function removeManager(accountId: string) {
  removingManager.value = accountId;
  await runAction(() => actions.value.removeManager(accountId), 'Manager removed');
  removingManager.value = null;
}

function exportCsv() {
  const rows = [
    ['time', 'card', 'location', 'item', 'amount_usd', 'cashback_usd', 'pending_usd'],
    ...purchases.value
      .filter((purchase) => purchase.at >= period.value.from && purchase.at < period.value.from + period.value.days * 86_400_000)
      .filter((purchase) => !locationFilter.value || purchase.locationId === locationFilter.value)
      .map((purchase) => [
        new Date(purchase.at).toISOString(),
        cardCodeOf(purchase.tokenId),
        locationName(purchase.locationId),
        purchase.category ?? 'Other',
        (purchase.cents / 100).toFixed(2),
        (purchase.cashback / 1_000_000).toFixed(2),
        (purchase.pending / 1_000_000).toFixed(2),
      ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = `${program.value.slug}-${new Date(period.value.from).toISOString().slice(0, 10)}-${period.value.days}d.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

const OWNER_EMAIL_KEY = 'fairly.merchant.email';
const emailReady = nearAuthAvailable();
const linkedEmail = ref<string | null>(typeof localStorage === 'undefined' ? null : localStorage.getItem(OWNER_EMAIL_KEY));
const linking = ref(false);

async function protectWithEmail() {
  const wallet = await loadMerchant();
  if (!wallet) return;
  linking.value = true;
  try {
    const identity = await linkEmail(wallet, 'merchant');
    linkedEmail.value = identity.email ?? 'your email';
    localStorage.setItem(OWNER_EMAIL_KEY, linkedEmail.value);
    showNotice('Email linked. You can recover the business on a new device.');
  } catch (cause) {
    showToast('error', 'Could not link your email', nearAuthMessage(cause));
  } finally {
    linking.value = false;
  }
}

const backingUp = ref(false);

async function downloadKey() {
  const wallet = await loadMerchant();
  if (!wallet || backingUp.value) return;
  let recovery: string;
  backingUp.value = true;
  try {
    recovery = await merchantBackupKey(wallet);
  } catch (cause) {
    backingUp.value = false;
    showToast('error', 'Could not prepare the backup', actionError(cause));
    return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([backupText('Fairly business key', wallet.accountId, recovery)], { type: 'text/plain' }));
  link.download = `fairly-business-key-${program.value.slug}.txt`;
  backingUp.value = false;
  link.click();
  URL.revokeObjectURL(link.href);
}

const memberStats = computed(() => {
  const total = passes.value.length;
  const visits = passes.value.reduce((sum, pass) => sum + pass.purchase_count, 0);
  const held = passes.value.reduce((sum, pass) => sum + Number(pass.balance) + Number(pass.pending), 0);
  return {
    total,
    top: passes.value.filter((pass) => pass.tier_index === topTier.value).length,
    averageVisits: total ? visits / total : 0,
    held,
  };
});

const fundHistory = computed(() =>
  events.value
    .filter((event) => ['pool_funded', 'pool_withdrawn', 'sale'].includes(event.event))
    .map((event) => ({
      id: event.id,
      at: new Date(event.created_at).getTime(),
      title: { pool_funded: 'Money added', pool_withdrawn: 'Money withdrawn', sale: 'Resale royalty' }[event.event] ?? event.event,
      amount: Number(event.event === 'sale' ? event.data.royalty : event.data.amount),
      sign: event.event === 'pool_withdrawn' ? -1 : 1,
      icon: (event.event === 'sale' ? 'tag' : event.event === 'pool_funded' ? 'download' : 'arrow') as IconName,
    }))
    .reverse()
    .slice(0, 12),
);

const dateTime = (time: number) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(time);
const relative = (time: number | undefined) => {
  if (!time) return 'Never';
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
};
const percent = (share: number) => `${Math.round(share * 100)}%`;
const shortAccount = (account: string) => (account.length > 32 ? `${account.slice(0, 12)}…${account.slice(-10)}` : account);

watch(view, () => window.scrollTo({ top: 0 }));

function showNotice(text: string, kind: ToastKind = 'success') {
  showToast(kind, text);
}

async function refreshProgram() {
  program.value = (await getProgram(program.value.slug)) ?? program.value;
}

async function loadPasses() {
  const tokenIds = [...new Set(events.value.filter((event) => event.event === 'pass_issued').map((event) => event.token_id as string))];
  const views = await Promise.all(tokenIds.map((tokenId) => getPass(tokenId).catch(() => null)));
  passes.value = views.filter((pass): pass is PassView => pass !== null);
}

async function refreshPass(tokenId: string) {
  const pass = await getPass(tokenId).catch(() => null);
  if (!pass) return;
  const others = passes.value.filter((entry) => entry.token_id !== tokenId);
  passes.value = [...others, pass];
}

function onEvent(event: FairlyEvent) {
  if (events.value.some((entry) => entry.id === event.id)) return;
  events.value = [...events.value, event];
  freshIds.value = new Set([...freshIds.value, event.id]);
  setTimeout(() => {
    const next = new Set(freshIds.value);
    next.delete(event.id);
    freshIds.value = next;
  }, 2000);
  if (event.event === 'purchase') {
    showNotice(`${cardCodeOf(String(event.token_id))} bought ${formatMoney(String(Number(event.data.amount_cents) * 10_000))} at ${locationName(String(event.data.location_id))}`, 'info');
  }
  if (event.token_id) refreshPass(event.token_id);
  refreshProgram();
}

async function fund(dollars: number) {
  funding.value = true;
  await runAction(() => actions.value.fund(dollars), `Added ${formatMoney(dollarsToBaseUnits(dollars))} of test money to the pool`);
  funding.value = false;
}

async function settleNow() {
  const total = program.value.pending_total;
  if (settling.value || BigInt(total) === 0n) return;
  settling.value = true;
  await runAction(() => actions.value.settle(total), `Settled ${formatMoney(total)}. Pending cashback is now available on the cards`);
  settling.value = false;
}

function printJoin() {
  window.print();
}

onMounted(async () => {
  collapsed.value = localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  const owner = await loadMerchant();
  isOwner.value = owner?.accountId === program.value.owner;
  const manager = await loadManager(program.value.slug);
  managerAccount.value = manager?.accountId ?? null;
  if (isOwner.value && owner) actions.value = ownerActions(owner, program.value.slug);
  else if (manager && program.value.managers.some((entry) => entry.account_id === manager.accountId)) actions.value = managerActions(manager, program.value.slug);
  else actions.value = props.isDemo ? demoActions(program.value.slug) : readOnlyActions();
  signerWallet.value = isOwner.value ? owner : manager;
  connectScreen.value = isStandalone() && !props.isDemo && actions.value.role === 'viewer';
  const params = new URLSearchParams(window.location.search);
  if (params.has('launched')) {
    launched.value = true;
    history.replaceState(null, '', window.location.pathname);
  }
  events.value = await programEvents(program.value.slug);
  loading.value = false;
  unsubscribe = subscribeToEvents({
    column: 'program_slug',
    value: program.value.slug,
    onEvent,
    onState: (state) => (connection.value = state),
  });
  await loadPasses();
});

onBeforeUnmount(() => {
  unsubscribe();
});
</script>

<template>
  <div class="flex min-h-[calc(100dvh-1.75rem)]" :style="{ '--brand': brand }">
    <div v-if="connectScreen" class="fixed inset-0 z-50 flex overflow-auto bg-bo-bg">
      <ShortcutConnect
        :slug="program.slug"
        context="merchant"
        :app-name="program.name"
        place="dashboard"
        skip-label="Just look around (view only)"
        @connected="openConnectedShortcut"
        @skip="connectScreen = false"
      >
        <template #alternatives><a href="/business" class="underline underline-offset-4">Restore from a backup file or email</a></template>
      </ShortcutConnect>
    </div>
    <aside
      class="sticky top-7 z-30 flex h-[calc(100dvh-1.75rem)] shrink-0 flex-col border-r border-bo-line bg-white transition-all duration-300 print:hidden"
      :class="collapsed ? 'w-[68px]' : 'w-64'"
    >
      <div class="relative flex h-16 items-center border-b border-bo-line" :class="collapsed ? 'justify-center' : 'gap-2 px-5'">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-coral text-sm font-black text-ink">F</span>
        <span v-if="!collapsed" class="flex items-center gap-2"><span class="text-xl font-extrabold tracking-tight">Fairly</span><span class="text-xs font-semibold text-bo-muted">Business</span></span>
        <button
          type="button"
          class="absolute top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-md border border-bo-line bg-white text-bo-muted transition hover:border-bo-muted hover:text-bo-text"
          :class="collapsed ? '-right-3.5 shadow-sm' : 'right-3'"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggleSidebar"
        >
          <AppIcon name="chevron" class="size-4 transition" :class="collapsed ? '-rotate-90' : 'rotate-90'" />
        </button>
      </div>
      <div class="p-3">
        <div class="flex items-center gap-3 rounded-lg border border-bo-line" :class="collapsed ? 'justify-center p-1.5' : 'p-2'">
          <span class="grid size-9 shrink-0 place-items-center rounded-md" :style="{ background: brand, color: brandInk }"><AppIcon name="cup" class="size-5" /></span>
          <div v-if="!collapsed" class="min-w-0">
            <p class="truncate text-sm font-bold">{{ program.name }}</p>
            <p class="text-xs text-bo-muted">{{ program.locations.length }} {{ program.locations.length === 1 ? 'location' : 'locations' }}</p>
          </div>
        </div>
      </div>
      <nav class="space-y-0.5 px-3 text-sm font-semibold">
        <button
          v-for="[id, label, icon] in NAV"
          :key="id"
          type="button"
          class="group relative flex h-10 w-full items-center gap-3 rounded-lg transition"
          :class="[view === id ? 'bg-bo-bg text-bo-text' : 'text-bo-muted hover:bg-bo-bg hover:text-bo-text', collapsed ? 'justify-center' : 'px-3']"
          :aria-label="label"
          @click="view = id"
        >
          <AppIcon :name="icon" class="size-[18px]" />
          <span v-if="!collapsed">{{ label }}</span>
          <span v-if="id === 'funds' && poolRunway.level !== 'ok'" class="absolute top-2 size-2 rounded-full bg-red-600" :class="collapsed ? 'right-3' : 'left-6'" />
          <span
            v-if="collapsed"
            class="pointer-events-none absolute left-full ml-3 -translate-x-1 rounded-md bg-bo-text px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
          >
            {{ label }}
          </span>
        </button>
      </nav>
      <div class="mt-auto border-t border-bo-line" :class="collapsed ? 'p-2' : 'p-4'">
        <template v-if="!collapsed">
          <div class="flex items-center justify-between text-sm">
            <span class="text-bo-muted">Cashback pool</span>
            <span class="font-mono font-bold" :style="{ color: poolRunway.level === 'ok' ? undefined : runwayColor }">{{ formatMoney(program.pool_balance) }}</span>
          </div>
          <p class="mt-3 truncate text-xs text-bo-muted" :title="program.owner">{{ program.owner }}</p>
          <p class="text-xs text-bo-muted">{{ isOwner ? 'Owner · test money' : isManager ? `Manager · ${managedLocation ? locationName(managedLocation) : 'all locations'}` : isDemo ? 'Shared demo · test money' : 'View only' }}</p>
        </template>
        <span v-else class="mx-auto block size-2 rounded-full" :style="{ background: runwayColor }" :title="`Cashback pool ${formatMoney(program.pool_balance)}`" />
      </div>
    </aside>

    <main class="min-w-0 flex-1">
      <div v-if="poolRunway.level !== 'ok'" class="flex items-center gap-4 px-8 py-3 text-white print:hidden" :class="poolRunway.level === 'empty' ? 'bg-red-700' : 'bg-red-600'">
        <p class="flex-1 text-sm">
          <b>{{ poolRunway.level === 'empty' ? 'The cashback pool is empty.' : `The cashback pool runs out in about ${poolRunway.days} days.` }}</b>
          <span class="text-white/85">
            {{ poolRunway.level === 'empty' ? ' Purchases still count, but cashback waits as pending until you settle.' : ' Add money so customers keep earning without a pause.' }}
          </span>
        </p>
        <button class="h-9 rounded-lg bg-white px-4 text-sm font-bold text-red-700 transition hover:bg-red-50" @click="view = 'funds'">Add money</button>
      </div>

      <section v-if="view === 'overview'">
        <div class="flex flex-wrap items-center gap-3 border-b border-bo-line px-8 py-4">
          <h1 class="text-2xl font-bold">Overview</h1>
          <span v-if="isDemo" class="mr-auto rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800" data-testid="sample-data-label">Sample data</span>
          <span v-else class="mr-auto" />
          <span class="flex items-center gap-1.5 text-xs font-semibold" :class="connection === 'live' ? 'text-[#1F9D6B]' : 'text-bo-muted'">
            <span class="size-2 rounded-full" :class="connection === 'live' ? 'animate-pulse bg-[#1F9D6B]' : 'bg-bo-muted'" />
            {{ connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting' : 'Offline' }}
          </span>
          <div class="flex rounded-lg border border-bo-line bg-white p-1 text-sm font-semibold">
            <button
              v-for="days in [7, 30, 90] as RangeDays[]"
              :key="days"
              type="button"
              class="h-8 rounded-md px-3 transition"
              :class="!customRange && range === days ? 'bg-bo-text text-white' : 'text-bo-muted hover:text-bo-text'"
              @click="selectRange(days)"
            >
              {{ days }}d
            </button>
            <DateRangePicker v-model="customRange" :active="customRange !== null" @update:model-value="activityPage = 0" />
          </div>
          <SelectMenu v-model="locationFilter" class="w-48" :options="locationOptions" label="Location" icon="pin" @update:model-value="activityPage = 0" />
          <button
            type="button"
            class="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition"
            :class="compare ? 'border-bo-text bg-bo-text text-white' : 'border-bo-line bg-white text-bo-muted hover:text-bo-text'"
            :aria-pressed="compare"
            title="Compare with the previous period"
            @click="compare = !compare"
          >
            <AppIcon name="compare" class="size-4" />Compare
          </button>
          <button
            type="button"
            class="flex h-10 items-center gap-2 rounded-lg border border-bo-line bg-white px-3 text-sm font-semibold text-bo-muted transition hover:text-bo-text"
            title="Download the purchases of this period as CSV"
            @click="exportCsv"
          >
            <AppIcon name="download" class="size-4" />Export CSV
          </button>
        </div>

        <div class="space-y-5 p-8">
          <div
            v-if="pendingTotal > 0n"
            class="flex flex-wrap items-center gap-4 rounded-xl border p-5"
            :class="settlementOverdue ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'"
            data-testid="pending-to-settle"
          >
            <div class="flex-1">
              <p class="flex items-center gap-1 text-sm font-semibold text-bo-muted">Pending to settle <InfoTip title="Pending to settle" :text="TIPS.pending" align="left" /></p>
              <p class="mt-1 font-mono text-4xl font-extrabold" data-testid="pending-amount">{{ formatMoney(program.pending_total) }}</p>
              <p class="mt-1 text-sm" :class="settlementOverdue ? 'font-semibold text-red-700' : 'text-bo-muted'" data-testid="settlement-status">
                <template v-if="settlementOverdue">Weekly settlement overdue: some cashback has waited {{ pendingDays }} days. Settle now so customers can use it.</template>
                <template v-else>Waiting on {{ pendingCards || 'some' }} {{ pendingCards === 1 ? 'card' : 'cards' }}. Settle weekly to make it available to customers.</template>
              </p>
            </div>
            <button
              v-if="canSettle"
              class="h-11 rounded-lg px-5 font-semibold transition hover:brightness-95 disabled:opacity-40"
              :style="{ background: brand, color: brandInk }"
              :disabled="settling"
              data-testid="settle-now"
              @click="settleNow"
            >
              {{ settling ? 'Settling…' : `Settle now · ${formatMoney(program.pending_total)}` }}
            </button>
          </div>
          <div class="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div class="rounded-xl border border-bo-line bg-white p-6">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-sm font-semibold text-bo-muted">Sales from members</p>
                  <p class="mt-2 font-mono text-5xl font-extrabold tracking-tight">{{ formatMoney(String(stats.salesCents * 10_000)) }}</p>
                  <p class="mt-2 text-sm">
                    <span v-if="previousStats" class="font-bold" :class="stats.salesCents >= previousStats.salesCents ? 'text-[#1F9D6B]' : 'text-red-600'">{{ changeLabel(stats.salesCents, previousStats.salesCents) }} · </span>
                    <span class="text-bo-muted">{{ stats.visits }} member {{ stats.visits === 1 ? 'visit' : 'visits' }} · {{ periodLabel }}</span>
                  </p>
                </div>
                <span class="grid h-8 place-items-center rounded-md bg-bo-bg px-3 text-xs font-semibold">{{ filterLabel }}</span>
              </div>
              <SalesChart class="mt-6" :series="stats.series" :previous="previousStats?.series" :color="brand" />
            </div>
            <div class="grid grid-cols-2 gap-5">
              <div class="rounded-xl border border-bo-line bg-white p-5">
                <p class="flex items-center gap-1 text-sm font-semibold text-bo-muted">Cashback given <InfoTip title="Cashback" :text="TIPS.cashback" align="left" /></p>
                <p class="mt-2 font-mono text-3xl font-extrabold">{{ formatMoney(String(stats.cashback)) }}</p>
                <p class="mt-1 text-xs text-bo-muted">{{ previousStats ? changeLabel(stats.cashback, previousStats.cashback) : 'Added to customer cards' }}</p>
              </div>
              <div class="rounded-xl border border-bo-line bg-white p-5">
                <p class="flex items-center gap-1 text-sm font-semibold text-bo-muted">Royalties earned <InfoTip title="Royalty" :text="TIPS.royalty" /></p>
                <p class="mt-2 font-mono text-3xl font-extrabold">{{ formatMoney(String(stats.royalties)) }}</p>
                <p class="mt-1 text-xs text-bo-muted">{{ previousStats ? changeLabel(stats.royalties, previousStats.royalties) : `${formatPercent(program.royalty_bps)} of each card resale` }}</p>
              </div>
              <div class="rounded-xl border border-bo-line bg-white p-5">
                <p class="flex items-center gap-1 text-sm font-semibold text-bo-muted">Return on cashback <InfoTip title="Return on cashback" :text="TIPS.return" align="left" /></p>
                <p class="mt-2 font-mono text-3xl font-extrabold">{{ returnOnCashback ? `${Math.round(returnOnCashback)}x` : '–' }}</p>
                <p class="mt-1 text-xs text-bo-muted">Sales per $1.00 of cashback</p>
              </div>
              <div class="rounded-xl border border-bo-line bg-white p-5">
                <p class="text-sm font-semibold text-bo-muted">Active cards</p>
                <p class="mt-2 font-mono text-3xl font-extrabold">{{ stats.activeCards }}</p>
                <p class="mt-1 text-xs text-bo-muted">{{ previousStats ? changeLabel(stats.activeCards, previousStats.activeCards) : 'Used at least once' }}</p>
              </div>
            </div>
          </div>

          <div class="grid gap-5 xl:grid-cols-3">
            <div class="rounded-xl border border-bo-line bg-white p-6">
              <h2 class="font-bold">By location</h2>
              <div class="mt-4 space-y-3">
                <div v-for="location in program.locations" :key="location.id">
                  <div class="flex justify-between text-sm">
                    <span class="font-semibold">{{ location.name }}</span>
                    <span class="font-mono">{{ formatMoney(String((stats.byLocation.get(location.id) ?? 0) * 10_000)) }}</span>
                  </div>
                  <div class="mt-1.5 h-2 rounded-full bg-bo-bg">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :style="{ width: `${stats.salesCents ? ((stats.byLocation.get(location.id) ?? 0) / stats.salesCents) * 100 : 0}%`, background: brand }"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div class="rounded-xl border border-bo-line bg-white p-6">
              <h2 class="font-bold">What members buy</h2>
              <p class="text-xs text-bo-muted">Tagged at the counter</p>
              <p v-if="!stats.byCategory.length" class="mt-4 text-sm text-bo-muted">No purchases in this period.</p>
              <div class="mt-4 space-y-3">
                <div v-for="category in stats.byCategory.slice(0, 5)" :key="category.name">
                  <div class="flex justify-between text-sm"><span class="font-semibold">{{ category.name }}</span><span class="font-mono">{{ percent(category.share) }}</span></div>
                  <div class="mt-1 h-1.5 rounded-full bg-bo-bg"><div class="h-full rounded-full bg-bo-text" :style="{ width: percent(category.share) }" /></div>
                </div>
              </div>
            </div>
            <div class="rounded-xl border border-bo-line bg-white p-6">
              <h2 class="font-bold">New and returning members</h2>
              <p class="text-xs text-bo-muted">Share of member visits</p>
              <div class="mt-4 flex items-center gap-6">
                <svg viewBox="0 0 42 42" class="size-32 -rotate-90" aria-hidden="true">
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#F4F4F2" stroke-width="6" />
                  <circle cx="21" cy="21" r="15.9" fill="none" :stroke="brand" stroke-width="6" :stroke-dasharray="`${stats.returningShare * 100} ${100 - stats.returningShare * 100}`" />
                </svg>
                <div class="space-y-3 text-sm">
                  <p><span class="mr-2 inline-block size-3 rounded-sm" :style="{ background: brand }" /><b class="font-mono">{{ percent(stats.returningShare) }}</b> returning</p>
                  <p><span class="mr-2 inline-block size-3 rounded-sm border border-bo-line bg-bo-bg" /><b class="font-mono">{{ stats.visits ? percent(1 - stats.returningShare) : '0%' }}</b> first visit</p>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-bo-line bg-white">
            <div class="flex items-center justify-between border-b border-bo-line px-6 py-4">
              <h2 class="font-bold">Recent activity</h2>
              <span class="text-sm text-bo-muted">{{ filterLabel }}</span>
            </div>
            <p v-if="loading" class="px-6 py-6 text-sm text-bo-muted">Loading activity…</p>
            <p v-else-if="!activity.length" class="px-6 py-6 text-sm text-bo-muted">No activity yet. Purchases from the counter show up here as they happen.</p>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-left text-bo-muted">
                  <tr>
                    <th class="px-6 py-3 font-semibold">Time</th>
                    <th class="py-3 font-semibold">Card</th>
                    <th class="py-3 font-semibold">Location</th>
                    <th class="py-3 font-semibold">Item</th>
                    <th class="py-3 text-right font-semibold">Amount</th>
                    <th class="px-6 py-3 text-right font-semibold">Cashback or royalty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in activityRows" :key="row.id" class="border-t border-bo-line transition-colors duration-1000" :style="freshIds.has(row.id) ? { background: `${brand}22` } : {}">
                    <td class="px-6 py-3 font-mono text-bo-muted">{{ dateTime(row.at) }}</td>
                    <td class="py-3 font-mono font-semibold">{{ row.card }}</td>
                    <td class="py-3">{{ row.place }}</td>
                    <td class="py-3">{{ row.item }}</td>
                    <td class="py-3 text-right font-mono">{{ row.amount }}</td>
                    <td class="px-6 py-3 text-right font-mono" :class="row.kind === 'royalty' && 'font-bold text-[#1F9D6B]'">
                      {{ row.kind === 'royalty' ? `Royalty ${row.result}` : row.result }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <TablePager v-model="activityPage" class="border-t border-bo-line px-6 py-3" :total="activity.length" :page-size="ACTIVITY_PAGE_SIZE" noun="entries" />
          </div>
        </div>
      </section>

      <section v-else-if="view === 'customers'" class="p-8">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="mr-auto text-2xl font-bold">Customers</h1>
          <input
            v-model="search"
            class="h-11 w-64 rounded-lg border border-bo-line bg-white px-3 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus:border-bo-text focus:outline-none"
            placeholder="Search card number"
            aria-label="Search card number"
            @input="customerPage = 0"
          />
        </div>
        <div class="mt-5 grid gap-4 md:grid-cols-4">
          <div class="rounded-xl p-5" :style="{ background: brand, color: brandInk }">
            <p class="text-sm font-semibold opacity-80">Members</p>
            <p class="mt-3 font-mono text-4xl font-extrabold">{{ memberStats.total }}</p>
            <p class="mt-1 text-xs opacity-80">Cards issued</p>
          </div>
          <div class="rounded-xl border border-bo-line bg-white p-5">
            <p class="text-sm font-semibold text-bo-muted">{{ program.tiers[topTier]?.name }} members</p>
            <p class="mt-3 font-mono text-4xl font-extrabold">{{ memberStats.top }}</p>
            <p class="mt-1 text-xs text-bo-muted">Top level</p>
          </div>
          <div class="rounded-xl border border-bo-line bg-white p-5">
            <p class="text-sm font-semibold text-bo-muted">Avg visits per member</p>
            <p class="mt-3 font-mono text-4xl font-extrabold">{{ memberStats.averageVisits.toFixed(1) }}</p>
            <p class="mt-1 text-xs text-bo-muted">Since each card was issued</p>
          </div>
          <div class="rounded-xl border border-bo-line bg-white p-5">
            <p class="flex items-center gap-1 text-sm font-semibold text-bo-muted">Cashback held on cards <InfoTip title="Cashback held on cards" :text="TIPS.held" /></p>
            <p class="mt-3 font-mono text-4xl font-extrabold">{{ formatMoney(String(memberStats.held)) }}</p>
            <p class="mt-1 text-xs text-bo-muted">Not spent yet</p>
          </div>
        </div>
        <div class="mt-5 overflow-x-auto rounded-xl border border-bo-line bg-white">
          <table class="w-full text-sm">
            <thead class="bg-bo-bg/60 text-left text-bo-muted">
              <tr>
                <th class="px-6 py-3 font-semibold">Card</th>
                <th class="py-3 font-semibold">Level</th>
                <th class="py-3 font-semibold">Visits</th>
                <th class="py-3 font-semibold">Spent</th>
                <th class="py-3 font-semibold">Balance</th>
                <th class="py-3 font-semibold">Last visit</th>
                <th class="py-3 font-semibold">Location</th>
                <th class="px-6" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="!customerRows.length"><td colspan="8" class="px-6 py-6 text-bo-muted">{{ loading || !passes.length ? 'Loading cards…' : 'No card matches that number.' }}</td></tr>
              <tr
                v-for="pass in customerRows"
                :key="pass.token_id"
                class="cursor-pointer border-t border-bo-line transition hover:bg-bo-bg/60"
                tabindex="0"
                @click="openDrawer({ kind: 'customer', tokenId: pass.token_id })"
                @keydown.enter="openDrawer({ kind: 'customer', tokenId: pass.token_id })"
              >
                <td class="px-6 py-3 font-mono font-bold">{{ cardCodeOf(pass.token_id) }}</td>
                <td class="py-3">
                  <span class="inline-flex items-center gap-1.5 font-semibold"><span class="size-2.5 rounded-sm" :style="{ background: TIER_COLORS[pass.tier_index] ?? TIER_COLORS[3] }" />{{ pass.tier_name }}</span>
                </td>
                <td class="py-3 font-mono">{{ pass.purchase_count }}</td>
                <td class="py-3 font-mono">{{ formatMoney(String(pass.total_spent_cents * 10_000)) }}</td>
                <td class="py-3 font-mono">{{ formatMoney(pass.balance) }}</td>
                <td class="py-3 text-bo-muted">{{ relative(lastVisit.get(pass.token_id)?.at) }}</td>
                <td class="py-3">{{ lastVisit.get(pass.token_id) ? locationName(lastVisit.get(pass.token_id)!.locationId) : '–' }}</td>
                <td class="px-6 text-bo-muted"><AppIcon name="chevron" class="size-4 -rotate-90" /></td>
              </tr>
            </tbody>
          </table>
          <TablePager v-model="customerPage" class="border-t border-bo-line px-6 py-3" :total="customers.length" :page-size="PAGE_SIZE" noun="cards" />
        </div>
        <p class="mt-3 text-xs text-bo-muted">Cards show no names or emails. An email linked for recovery stays with the NEAR Auth login and never appears here.</p>
      </section>

      <section v-else-if="view === 'funds'" class="p-8">
        <h1 class="text-2xl font-bold">Cashback pool</h1>
        <div class="mt-5 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
          <div class="rounded-xl border bg-white p-6" :class="poolRunway.level === 'ok' ? 'border-bo-line' : 'border-red-300'">
            <p class="flex items-center gap-1 text-sm font-semibold text-bo-muted">Available for cashback <InfoTip title="Cashback pool" :text="TIPS.pool" align="left" /></p>
            <p class="mt-2 font-mono text-6xl font-extrabold" :style="{ color: poolRunway.level === 'ok' ? undefined : runwayColor }">{{ formatMoney(program.pool_balance) }}</p>
            <div v-if="pendingTotal > 0n" class="mt-2 flex flex-wrap items-center gap-3">
              <p class="flex items-center gap-1 text-sm font-semibold text-amber-700">
                {{ formatMoney(program.pending_total) }} pending on cards <InfoTip title="Pending cashback" :text="TIPS.pending" align="left" />
              </p>
              <button v-if="canSettle" class="h-9 rounded-lg border border-bo-line px-4 text-sm font-semibold transition hover:bg-bo-bg disabled:opacity-40" :disabled="settling" @click="settleNow">
                {{ settling ? 'Settling…' : 'Settle now' }}
              </button>
            </div>
            <div class="mt-6">
              <div class="flex justify-between text-sm">
                <span class="font-semibold">Runway</span>
                <span class="font-mono font-bold" :style="{ color: runwayColor }">{{ poolRunway.days === null ? 'No recent cashback' : `~${poolRunway.days} days left` }}</span>
              </div>
              <div class="mt-2 h-3 overflow-hidden rounded-full bg-bo-bg">
                <div class="h-full rounded-full transition-all duration-700" :style="{ width: `${poolRunway.days === null ? 100 : Math.min(100, (poolRunway.days / 30) * 100)}%`, background: runwayColor }" />
              </div>
              <p class="mt-3 text-sm text-bo-muted">At the pace of the last 7 days you give about {{ formatMoney(String(Math.round(perDay))) }} a day in cashback.</p>
            </div>
            <div v-if="isDemo || isOwner" class="mt-6">
              <p class="text-sm font-semibold">Add test money</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="dollars in FUND_OPTIONS"
                  :key="dollars"
                  class="h-11 rounded-lg px-5 font-semibold transition hover:brightness-95 disabled:opacity-40"
                  :style="{ background: brand, color: brandInk }"
                  :disabled="funding"
                  @click="fund(dollars)"
                >
                  {{ funding ? 'Adding…' : `+ $${dollars}` }}
                </button>
              </div>
              <p class="mt-2 text-xs text-bo-muted">The testnet faucet mints test dollars and moves them into the pool.</p>
              <p class="mt-1 text-xs text-bo-muted">Start small: cashback above your pool waits as Pending until your weekly settlement.</p>
            </div>
            <div v-if="isOwner" class="mt-6 border-t border-bo-line pt-5">
              <p class="text-sm font-semibold">Withdraw</p>
              <form class="mt-2 flex flex-wrap gap-2" @submit.prevent="withdraw">
                <span class="flex h-11 w-40 items-center rounded-lg border border-bo-line px-3 focus-within:border-bo-text">
                  <span class="text-bo-muted">$</span>
                  <input v-model.number="withdrawDollars" type="number" min="1" step="0.01" :max="pool / 1_000_000" class="w-full bg-transparent font-mono focus:outline-none" placeholder="50.00" aria-label="Amount to withdraw" />
                </span>
                <button type="submit" class="h-11 rounded-lg border border-bo-line px-5 font-semibold transition hover:bg-bo-bg disabled:opacity-40" :disabled="withdrawing || !withdrawDollars || withdrawDollars * 1_000_000 > pool">
                  {{ withdrawing ? 'Withdrawing…' : 'Withdraw' }}
                </button>
              </form>
              <p class="mt-2 text-xs text-bo-muted">Unused money goes back to your business account as test dollars.</p>
            </div>
          </div>
          <div class="rounded-xl border border-bo-line bg-white p-6">
            <h2 class="font-bold">When money runs low</h2>
            <ol class="mt-4 space-y-4 text-sm">
              <li class="flex gap-3">
                <span class="grid size-7 shrink-0 place-items-center rounded-full bg-amber-100 font-bold text-amber-700">1</span>
                <div><p class="font-semibold">7 days left</p><p class="text-bo-muted">A red banner shows on every screen of this dashboard.</p></div>
              </li>
              <li class="flex gap-3">
                <span class="grid size-7 shrink-0 place-items-center rounded-full bg-red-600 font-bold text-white">2</span>
                <div><p class="font-semibold">Empty</p><p class="text-bo-muted">Purchases still count for visits and levels. Cashback is saved as Pending on the cards and becomes Available automatically when you settle. Customers see "Pending", never an error.</p></div>
              </li>
            </ol>
          </div>
        </div>
        <div class="mt-5 rounded-xl border border-bo-line bg-white">
          <h2 class="border-b border-bo-line px-6 py-4 font-bold">History</h2>
          <p v-if="!fundHistory.length" class="px-6 py-6 text-sm text-bo-muted">No top-ups recorded yet.</p>
          <ul class="divide-y divide-bo-line text-sm">
            <li v-for="entry in fundHistory" :key="entry.id" class="flex items-center gap-3 px-6 py-3">
              <span class="grid size-9 place-items-center rounded-lg bg-bo-bg"><AppIcon :name="entry.icon" class="size-4" /></span>
              <div class="flex-1"><p class="font-semibold">{{ entry.title }}</p><p class="text-xs text-bo-muted">{{ dateTime(entry.at) }}</p></div>
              <span class="font-mono font-bold" :class="entry.sign > 0 && 'text-[#1F9D6B]'">{{ entry.sign > 0 ? '+' : '−' }}{{ formatMoney(String(entry.amount)) }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section v-else-if="view === 'locations'" class="p-8">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Locations</h1>
          <button
            v-if="isDemo || isOwner"
            type="button"
            class="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition hover:brightness-95"
            :style="{ background: brand, color: brandInk }"
            @click="locationForm = { id: null, name: '', place: null }; locationError = ''"
          >
            <AppIcon name="plus" class="size-4" />Add location
          </button>
        </div>
        <div class="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <div class="h-[460px]"><MapView :pins="locationPins" :color="brand" /></div>
          <div class="space-y-4">
          <div v-for="location in program.locations" :key="location.id" class="rounded-xl border border-bo-line bg-white p-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-lg font-bold">{{ location.name }}</p>
                <p class="text-sm text-bo-muted">{{ location.address }}</p>
                <p v-if="!location.lat && !location.lng" class="mt-1 text-xs font-semibold text-amber-700">Not on the map yet. Edit it to pick the address.</p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="grid h-7 place-items-center rounded-md bg-bo-bg px-2.5 text-xs font-semibold">
                  {{ devicesAt(location.id) }} {{ devicesAt(location.id) === 1 ? 'device' : 'devices' }}
                </span>
                <button
                  v-if="isDemo || isOwner"
                  type="button"
                  class="h-7 rounded-md border border-bo-line px-2.5 text-xs font-semibold transition hover:border-bo-muted"
                  @click="editLocation(location.id)"
                >
                  Edit
                </button>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div class="rounded-lg bg-bo-bg p-3">
                <p class="text-xs text-bo-muted">Member sales · {{ periodLabel }}</p>
                <p class="font-mono font-bold">{{ formatMoney(String((stats.byLocation.get(location.id) ?? 0) * 10_000)) }}</p>
              </div>
              <div class="rounded-lg bg-bo-bg p-3">
                <p class="text-xs text-bo-muted">Cashback today</p>
                <p class="font-mono font-bold">{{ formatMoney(location.cashback_today) }} / {{ formatMoney(program.daily_cap) }}</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section v-else-if="view === 'devices'" class="p-8">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Counter devices</h1>
          <button
            v-if="manageableLocations.length"
            type="button"
            class="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition hover:brightness-95"
            :style="{ background: brand, color: brandInk }"
            @click="pairing = { locationId: manageableLocations[0]?.id ?? '', code: '', busy: false, error: '' }"
          >
            <AppIcon name="plus" class="size-4" />Connect a device
          </button>
        </div>
        <div class="mt-5 flex items-center gap-3 rounded-xl border border-bo-line bg-white p-4 text-sm">
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-bo-bg"><AppIcon name="tablet" class="size-5" /></span>
          <p>Each device has its own key that can only add purchases and accept balance codes at its location, up to the daily limit. It never holds the owner key and can never move money. If a device is lost, pause it here: it stops working at once.</p>
        </div>
        <div class="mt-4 overflow-x-auto rounded-xl border border-bo-line bg-white">
          <table class="w-full text-sm">
            <thead class="bg-bo-bg/60 text-left text-bo-muted">
              <tr>
                <th class="px-6 py-3 font-semibold">Device account</th>
                <th class="py-3 font-semibold">Location</th>
                <th class="py-3 font-semibold">Purchases today</th>
                <th class="py-3 font-semibold">Last used</th>
                <th class="py-3 font-semibold">Status</th>
                <th class="px-6" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="!deviceRows.length"><td colspan="6" class="px-6 py-6 text-bo-muted">No devices connected yet.</td></tr>
              <tr
                v-for="cashier in deviceRows"
                :key="cashier.account_id"
                class="cursor-pointer border-t border-bo-line transition hover:bg-bo-bg/60"
                :class="!cashier.active && 'opacity-60'"
                tabindex="0"
                @click="openDrawer({ kind: 'device', accountId: cashier.account_id })"
                @keydown.enter="openDrawer({ kind: 'device', accountId: cashier.account_id })"
              >
                <td class="px-6 py-3">
                  <span class="flex items-center gap-3">
                    <span class="grid size-9 place-items-center rounded-lg bg-bo-bg"><AppIcon name="tablet" class="size-5" /></span>
                    <span class="font-mono" :title="cashier.account_id">{{ shortAccount(cashier.account_id) }}</span>
                  </span>
                </td>
                <td class="py-3">{{ locationName(cashier.location_id) }}</td>
                <td class="py-3 font-mono">{{ deviceUse(cashier.account_id).today }}</td>
                <td class="py-3 text-bo-muted">{{ relative(deviceUse(cashier.account_id).last) }}</td>
                <td class="py-3">
                  <span class="inline-flex items-center gap-1.5 text-xs font-semibold" :class="cashier.active ? 'text-[#1F9D6B]' : 'text-bo-muted'">
                    <span class="size-2 rounded-full" :class="cashier.active ? 'bg-[#1F9D6B]' : 'bg-bo-muted'" />{{ cashier.active ? 'Active' : 'Paused' }}
                  </span>
                </td>
                <td class="px-6 py-3 text-right">
                  <button
                    v-if="canManageDevicesAt(cashier.location_id)"
                    type="button"
                    class="h-8 rounded-md border border-bo-line px-3 text-xs font-semibold transition disabled:opacity-40"
                    :class="cashier.active ? 'hover:border-red-300 hover:text-red-700' : 'hover:border-bo-muted'"
                    :disabled="revoking === cashier.account_id"
                    @click.stop="cashier.active ? revokeDevice(cashier.account_id) : reactivateDevice(cashier.account_id, cashier.location_id)"
                  >
                    {{ revoking === cashier.account_id ? 'Saving…' : cashier.active ? 'Pause' : 'Reactivate' }}
                  </button>
                  <AppIcon v-else name="chevron" class="ml-auto size-4 -rotate-90 text-bo-muted" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <BoostsView v-else-if="view === 'boosts'" :program="program" :actions="actions" @changed="refreshProgram" @notice="showNotice" />

      <template v-else-if="view === 'setup'">
        <SetupWizard v-if="isOwner" :key="program.slug" :program="program" :actions="actions" @saved="refreshProgram" @notice="showNotice" />
        <section v-else class="p-8">
          <h1 class="text-2xl font-bold">Brand and rewards</h1>
          <p class="mt-3 max-w-xl text-sm text-bo-muted">Only the owner can change the brand and rewards.</p>
          <dl class="mt-5 grid max-w-xl grid-cols-2 gap-2 text-sm">
            <div class="rounded-lg border border-bo-line bg-white p-3"><dt class="text-xs text-bo-muted">Cashback</dt><dd class="font-mono font-bold">{{ formatPercent(program.cashback_bps) }}</dd></div>
            <div class="rounded-lg border border-bo-line bg-white p-3"><dt class="text-xs text-bo-muted">Resale share</dt><dd class="font-mono font-bold">{{ formatPercent(program.royalty_bps) }}</dd></div>
            <div class="rounded-lg border border-bo-line bg-white p-3"><dt class="text-xs text-bo-muted">Daily limit per location</dt><dd class="font-mono font-bold">{{ formatMoney(program.daily_cap) }}</dd></div>
            <div class="rounded-lg border border-bo-line bg-white p-3"><dt class="text-xs text-bo-muted">Time zone</dt><dd class="font-mono font-bold">{{ offsetLabel(program.utc_offset_minutes) }}</dd></div>
            <div v-for="tier in program.tiers" :key="tier.name" class="rounded-lg border border-bo-line bg-white p-3">
              <dt class="text-xs text-bo-muted">{{ tier.name }} · from {{ tier.min_purchases }} visits</dt><dd class="font-semibold">{{ tier.perk ?? 'No perk' }}</dd>
            </div>
          </dl>
          <p v-if="isDemo" class="mt-5 max-w-xl text-sm text-bo-muted">This is the shared demo café, so its terms stay fixed. To try the owner view, <a href="/business" class="font-semibold underline">register a test business</a>.</p>
        </section>
      </template>

      <section v-else-if="view === 'settings'" class="max-w-3xl p-8">
        <h1 class="text-2xl font-bold">Settings</h1>
        <div class="mt-5 divide-y divide-bo-line rounded-xl border border-bo-line bg-white">
          <div class="flex items-center justify-between gap-4 p-6">
            <div><p class="font-bold">Brand and rewards</p><p class="text-sm text-bo-muted">Name, color, logo, cashback and perks</p></div>
            <button type="button" class="h-9 rounded-lg border border-bo-line px-4 text-sm font-semibold transition hover:bg-bo-bg" @click="view = 'setup'">{{ isOwner ? 'Edit' : 'View' }}</button>
          </div>
          <div class="p-6">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-bold">Team</p>
                <p class="text-sm text-bo-muted">Managers connect and pause counter devices at their location. They cannot move money or change rewards.</p>
              </div>
              <button
                v-if="isOwner"
                type="button"
                class="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-bo-line px-4 text-sm font-semibold transition hover:bg-bo-bg"
                @click="invite = { locationId: program.locations[0]?.id ?? null, code: '', busy: false, error: '' }"
              >
                <AppIcon name="plus" class="size-4" />Invite a manager
              </button>
            </div>
            <ul class="mt-4 divide-y divide-bo-line rounded-lg border border-bo-line text-sm">
              <li class="flex items-center gap-3 p-3">
                <span class="grid size-9 place-items-center rounded-full bg-bo-text font-bold text-white">O</span>
                <span class="min-w-0 flex-1"><span class="block font-semibold">Owner</span><span class="block truncate font-mono text-xs text-bo-muted">{{ program.owner }}</span></span>
                <span class="text-xs text-bo-muted">Everything</span>
              </li>
              <li v-for="manager in program.managers" :key="manager.account_id" class="flex items-center gap-3 p-3">
                <span class="grid size-9 place-items-center rounded-full bg-bo-bg font-bold">M</span>
                <span class="min-w-0 flex-1"><span class="block font-semibold">Manager</span><span class="block truncate font-mono text-xs text-bo-muted">{{ manager.account_id }}</span></span>
                <span class="text-xs text-bo-muted">{{ manager.location_id ? locationName(manager.location_id) : 'All locations' }}</span>
                <button
                  v-if="isOwner"
                  type="button"
                  class="h-8 rounded-md border border-bo-line px-3 text-xs font-semibold transition hover:border-red-300 hover:text-red-700 disabled:opacity-40"
                  :disabled="removingManager === manager.account_id"
                  @click="removeManager(manager.account_id)"
                >
                  Remove
                </button>
              </li>
            </ul>
          </div>
          <div class="p-6">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-bold">Home screen</p>
                <p class="text-sm text-bo-muted">Open this dashboard from an icon on your phone, with the Fairly logo and {{ program.name }} name.</p>
              </div>
              <button
                v-if="installModeNow !== 'none'"
                type="button"
                class="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-bo-line px-4 text-sm font-semibold transition hover:bg-bo-bg"
                @click="installPrompt?.open()"
              >
                <AppIcon name="addSquare" class="size-4" />Add to home screen
              </button>
            </div>
            <div v-if="signerWallet" class="mt-4 rounded-lg border border-bo-line p-4">
              <p class="font-semibold">Connect home screen app</p>
              <p class="mb-3 text-sm text-bo-muted">On iPhone the home screen app starts empty. Open it, read its code and type it here.</p>
              <ShortcutCodeEntry :slug="program.slug" :wallet="signerWallet" />
            </div>
          </div>
          <div class="flex items-center justify-between gap-4 p-6">
            <div><p class="font-bold">Time zone</p><p class="text-sm text-bo-muted">Daily limits reset and boosts start at midnight in this time zone.</p></div>
            <span class="font-mono text-sm font-bold">{{ offsetLabel(program.utc_offset_minutes) }}</span>
          </div>
          <div v-if="isOwner" class="flex items-center justify-between gap-4 p-6">
            <div>
              <p class="font-bold">Back up your business key</p>
              <p class="text-sm text-bo-muted">The key lives in this browser. Keep a copy to manage the program from another device or after clearing the browser.</p>
            </div>
            <button type="button" class="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-bo-line px-4 text-sm font-semibold transition hover:bg-bo-bg disabled:opacity-50" :disabled="backingUp" @click="downloadKey">
              <BusySpinner v-if="backingUp" /><AppIcon v-else name="download" class="size-4" />{{ backingUp ? 'Preparing…' : 'Download' }}
            </button>
          </div>
          <div v-if="isOwner" class="flex items-center justify-between gap-4 p-6">
            <div>
              <p class="font-bold">Recover with email</p>
              <p class="text-sm text-bo-muted">
                {{ linkedEmail ? `Linked to ${linkedEmail}. Sign in with it on a new device to get the business back.` : emailReady ? 'Link an email with NEAR Auth. Fairly never stores it; NEAR Auth signs the recovery.' : 'Email recovery with NEAR Auth works in the local build; the hosted demo is waiting for approval.' }}
              </p>
            </div>
            <button
              v-if="emailReady && !linkedEmail"
              type="button"
              class="h-9 shrink-0 rounded-lg border border-bo-line px-4 text-sm font-semibold transition hover:bg-bo-bg disabled:opacity-40"
              :disabled="linking"
              @click="protectWithEmail"
            >
              <span class="flex items-center gap-2"><BusySpinner v-if="linking" />{{ linking ? 'Waiting for NEAR Auth…' : 'Link email' }}</span>
            </button>
          </div>
          <div class="flex items-center justify-between gap-4 p-6">
            <div>
              <p class="font-bold">{{ program.paused ? 'The program is paused' : 'Pause the program' }}</p>
              <p class="text-sm text-bo-muted">{{ program.paused ? 'Counters cannot add cashback or issue cards until you resume.' : 'Counters stop adding cashback. Cards keep their balance.' }}</p>
            </div>
            <button
              v-if="isOwner"
              type="button"
              class="h-9 shrink-0 rounded-lg border px-4 text-sm font-semibold transition disabled:opacity-40"
              :class="program.paused ? 'border-bo-text hover:bg-bo-bg' : 'border-coral text-coral-dark hover:bg-coral-soft'"
              :disabled="pausing"
              @click="togglePause"
            >
              {{ pausing ? 'Saving…' : program.paused ? 'Resume' : 'Pause' }}
            </button>
            <span v-else class="text-xs font-semibold text-bo-muted">Owner only</span>
          </div>
        </div>
      </section>

      <section v-else class="p-8">
        <h1 class="text-2xl font-bold print:hidden">Join QR</h1>
        <p class="mt-1 text-sm text-bo-muted print:hidden">Print it and place it at the counter. Customers scan it to get their card in seconds.</p>
        <div class="mt-5 flex flex-wrap items-start gap-6">
          <div class="w-80 rounded-2xl p-6 text-center shadow-soft" :style="{ background: brand, color: brandInk }">
            <p class="text-sm font-semibold opacity-80">{{ program.name }}</p>
            <p class="mt-1 text-2xl leading-tight font-extrabold">Get {{ formatPercent(program.cashback_bps) }} back on every visit</p>
            <div class="mx-auto mt-5 size-56 overflow-hidden rounded-xl bg-white p-2"><QrCode :value="joinUrl" /></div>
            <p class="mt-4 text-sm font-semibold">Scan with your phone camera</p>
            <p class="mt-1 text-xs opacity-70">No app. No sign-up.</p>
          </div>
          <div class="space-y-3 print:hidden">
            <button class="flex h-11 items-center gap-2 rounded-lg px-5 font-semibold transition hover:brightness-95" :style="{ background: brand, color: brandInk }" @click="printJoin">
              <AppIcon name="print" class="size-4" />Print
            </button>
            <a :href="joinUrl" target="_blank" rel="noopener" class="flex h-11 items-center gap-2 rounded-lg border border-bo-line bg-white px-5 font-semibold transition hover:border-bo-muted">
              <AppIcon name="link" class="size-4" />Open join page
            </a>
            <p class="max-w-xs font-mono text-xs break-all text-bo-muted">{{ joinUrl }}</p>
          </div>
        </div>
      </section>
    </main>

    <SideDrawer
      v-if="drawer?.kind === 'customer'"
      :title="cardCodeOf(drawer.tokenId)"
      :subtitle="drawerPass ? `${drawerPass.tier_name} member` : 'Card'"
      @close="drawer = null"
    >
      <template v-if="drawerPass">
        <img
          :src="`/api/art/${program.slug}/${drawerPass.tier_index}.svg?balance=${drawerPass.balance}&purchases=${drawerPass.purchase_count}&number=${cardCodeOf(drawerPass.token_id)}`"
          :alt="`${program.name} card ${cardCodeOf(drawerPass.token_id)}`"
          class="w-full rounded-xl shadow-soft"
        />
        <dl class="mt-5 grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Balance</dt><dd class="font-mono font-bold">{{ formatMoney(drawerPass.balance) }}</dd></div>
          <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Pending</dt><dd class="font-mono font-bold">{{ formatMoney(drawerPass.pending) }}</dd></div>
          <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Visits</dt><dd class="font-mono font-bold">{{ drawerPass.purchase_count }}</dd></div>
          <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Spent</dt><dd class="font-mono font-bold">{{ formatMoney(String(drawerPass.total_spent_cents * 10_000)) }}</dd></div>
          <div class="col-span-2 rounded-lg bg-bo-bg p-3">
            <dt class="text-xs text-bo-muted">Next level</dt>
            <dd class="font-semibold">{{ drawerPass.next_tier ? `${drawerPass.next_tier} in ${drawerPass.purchases_to_next_tier} ${drawerPass.purchases_to_next_tier === 1 ? 'visit' : 'visits'}` : 'Top level reached' }}</dd>
          </div>
        </dl>
      </template>
      <h3 class="mt-6 font-bold">History</h3>
      <p v-if="!drawerHistory.length" class="mt-2 text-sm text-bo-muted">No recorded activity yet.</p>
      <ul class="mt-2 divide-y divide-bo-line text-sm">
        <li v-for="entry in drawerHistoryRows" :key="entry.id" class="flex items-center gap-3 py-3">
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ entry.title }}</p>
            <p class="truncate text-xs text-bo-muted">{{ dateTime(entry.at) }}{{ entry.detail ? ` · ${entry.detail}` : '' }}</p>
          </div>
          <span class="font-mono font-bold" :class="entry.positive ? 'text-[#1F9D6B]' : ''">{{ entry.amount }}</span>
        </li>
      </ul>
      <TablePager v-if="drawerHistory.length" v-model="historyPage" class="mt-2 border-t border-bo-line pt-3" :total="drawerHistory.length" :page-size="HISTORY_PAGE_SIZE" noun="entries" />
    </SideDrawer>

    <SideDrawer
      v-if="drawer?.kind === 'device' && drawerDevice"
      :title="shortAccount(drawerDevice.account_id)"
      :subtitle="`Counter device · ${locationName(drawerDevice.location_id)}`"
      @close="drawer = null"
    >
      <dl class="grid grid-cols-2 gap-2 text-sm">
        <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Purchases today</dt><dd class="font-mono font-bold">{{ deviceStats.todayCount }}</dd></div>
        <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Cashback today</dt><dd class="font-mono font-bold">{{ formatMoney(String(deviceStats.todayCashback)) }}</dd></div>
        <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">All purchases</dt><dd class="font-mono font-bold">{{ deviceStats.total }}</dd></div>
        <div class="rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Last used</dt><dd class="font-semibold">{{ relative(deviceStats.lastUsed) }}</dd></div>
        <div class="col-span-2 rounded-lg bg-bo-bg p-3"><dt class="text-xs text-bo-muted">Account</dt><dd class="font-mono text-xs break-all">{{ drawerDevice.account_id }}</dd></div>
      </dl>
      <p class="mt-4 text-xs text-bo-muted">This device can add purchases and accept balance codes up to the daily limit of its location. It cannot move money out of the cashback pool.</p>
      <button
        v-if="canManageDevicesAt(drawerDevice.location_id)"
        type="button"
        class="mt-4 flex h-10 w-full items-center justify-center rounded-lg border font-semibold transition disabled:opacity-40"
        :class="drawerDevice.active ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-bo-line hover:bg-bo-bg'"
        :disabled="revoking === drawerDevice.account_id"
        @click="drawerDevice.active ? revokeDevice(drawerDevice.account_id) : reactivateDevice(drawerDevice.account_id, drawerDevice.location_id)"
      >
        {{ drawerDevice.active ? 'Pause this device' : 'Reactivate this device' }}
      </button>
      <a v-if="isDemo" :href="`/cashier/${program.slug}`" target="_blank" rel="noopener" class="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-bo-line font-semibold transition hover:border-bo-muted">
        <AppIcon name="link" class="size-4" />Open counter screen
      </a>
      <h3 class="mt-6 font-bold">Purchases recorded</h3>
      <p v-if="!drawerHistory.length" class="mt-2 text-sm text-bo-muted">No purchases recorded from this device yet.</p>
      <ul class="mt-2 divide-y divide-bo-line text-sm">
        <li v-for="entry in drawerHistoryRows" :key="entry.id" class="flex items-center gap-3 py-3">
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ entry.title }}</p>
            <p class="truncate text-xs text-bo-muted">{{ dateTime(entry.at) }} · {{ entry.detail }}</p>
          </div>
          <span class="font-mono font-bold text-[#1F9D6B]">{{ entry.amount }}</span>
        </li>
      </ul>
      <TablePager v-if="drawerHistory.length" v-model="historyPage" class="mt-2 border-t border-bo-line pt-3" :total="drawerHistory.length" :page-size="HISTORY_PAGE_SIZE" noun="purchases" />
    </SideDrawer>

    <div v-if="locationForm" class="fixed inset-0 z-50 grid place-items-center bg-bo-text/30 p-4" role="dialog" aria-modal="true" aria-label="Add location">
      <form class="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" @submit.prevent="saveLocation">
        <h2 class="text-xl font-bold">{{ locationForm.id ? 'Edit location' : 'Add location' }}</h2>
        <p class="mt-1 text-sm text-bo-muted">Each location has its own daily cashback limit and its own counter devices.</p>
        <label class="mt-5 block text-sm font-semibold">
          Name
          <input v-model="locationForm.name" required maxlength="64" class="mt-1.5 h-11 w-full rounded-lg border border-bo-line px-3.5 font-normal focus:border-bo-text focus:outline-none" placeholder="Uptown" />
        </label>
        <div class="mt-4 text-sm font-semibold">
          Address
          <LocationPicker
            v-model="locationForm.place"
            class="mt-1.5 font-normal"
            :color="brand"
            :label="locationForm.name"
            :others="locationPins"
          />
        </div>
        <p v-if="locationError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{{ locationError }}</p>
        <p class="mt-4 text-xs text-bo-muted">Saved on chain with the demo merchant key.</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="h-10 rounded-lg border border-bo-line px-4 font-semibold hover:bg-bo-bg" @click="locationForm = null">Cancel</button>
          <button type="submit" class="h-10 rounded-lg px-4 font-semibold transition hover:brightness-95 disabled:opacity-40" :style="{ background: brand, color: brandInk }" :disabled="savingLocation || !locationForm.name.trim() || !locationForm.place">
            {{ savingLocation ? 'Saving…' : locationForm.id ? 'Save location' : 'Add location' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="pairing" class="fixed inset-0 z-50 grid place-items-center bg-bo-text/30 p-4" role="dialog" aria-modal="true" aria-label="Connect a counter device">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 class="text-xl font-bold">Connect a counter device</h2>
        <ol class="mt-2 list-decimal space-y-1 pl-4 text-sm text-bo-muted">
          <li>On the tablet or phone at the counter, open <span class="font-mono text-bo-text">{{ origin }}/cashier/{{ program.slug }}</span>.</li>
          <li>It creates its own key and shows a 6-character code.</li>
          <li>Type the code here. The key never leaves the device.</li>
        </ol>
          <label class="mt-4 block text-sm font-semibold">
            Code shown on the device
            <input
              v-model="pairing.code"
              maxlength="7"
              class="mt-1.5 h-12 w-full rounded-lg border border-bo-line px-3.5 font-mono text-2xl tracking-[.2em] uppercase focus:border-bo-text focus:outline-none"
              placeholder="ABC-123"
              autocomplete="off"
            />
          </label>
        <div class="mt-4 text-sm font-semibold">
          Location
          <SelectMenu
            v-model="pairing.locationId"
            class="mt-1.5"
            :options="manageableLocations.map((location) => ({ value: location.id, label: location.name }))"
            label="Location"
            icon="pin"
          />
        </div>
        <p v-if="pairing.error" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{{ pairing.error }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="h-10 rounded-lg border border-bo-line px-4 font-semibold hover:bg-bo-bg" @click="pairing = null">Cancel</button>
          <button
            type="button"
            class="h-10 rounded-lg px-5 font-semibold transition hover:brightness-95 disabled:opacity-40"
            :style="{ background: brand, color: brandInk }"
            :disabled="pairing.busy || !pairing.locationId || pairing.code.replace(/[^0-9a-z]/gi, '').length !== 6"
            @click="connectDevice"
          >
            {{ pairing.busy ? 'Connecting…' : 'Connect device' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="invite" class="fixed inset-0 z-50 grid place-items-center bg-bo-text/30 p-4" role="dialog" aria-modal="true" aria-label="Invite a manager">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 class="text-xl font-bold">Invite a manager</h2>
        <ol class="mt-2 list-decimal space-y-1 pl-4 text-sm text-bo-muted">
          <li>The manager opens <span class="font-mono text-bo-text">{{ origin }}/business/{{ program.slug }}/team</span> on their own phone or computer.</li>
          <li>Their browser creates its own key and shows a 6-character code.</li>
          <li>Type the code here. Your owner key never leaves this browser.</li>
        </ol>
          <label class="mt-4 block text-sm font-semibold">
            Code shown on the manager screen
            <input
              v-model="invite.code"
              maxlength="7"
              class="mt-1.5 h-12 w-full rounded-lg border border-bo-line px-3.5 font-mono text-2xl tracking-[.2em] uppercase focus:border-bo-text focus:outline-none"
              placeholder="ABC-123"
              autocomplete="off"
            />
          </label>
        <div class="mt-4 text-sm font-semibold">
          Location
          <SelectMenu
            v-model="invite.locationId"
            class="mt-1.5"
            :options="[{ value: null, label: 'All locations' }, ...program.locations.map((location) => ({ value: location.id, label: location.name }))]"
            label="Location"
            icon="pin"
          />
        </div>
        <p v-if="invite.error" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{{ invite.error }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="h-10 rounded-lg border border-bo-line px-4 font-semibold hover:bg-bo-bg" @click="invite = null">Cancel</button>
          <button
            type="button"
            class="h-10 rounded-lg px-5 font-semibold transition hover:brightness-95 disabled:opacity-40"
            :style="{ background: brand, color: brandInk }"
            :disabled="invite.busy || invite.code.replace(/[^0-9a-z]/gi, '').length !== 6"
            @click="inviteManager"
          >
            {{ invite.busy ? 'Adding…' : 'Add manager' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="launched" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6" role="dialog" aria-modal="true" aria-label="Your program is live">
      <div class="w-full max-w-md rounded-xl bg-white p-8 text-center">
        <span class="mx-auto grid size-14 place-items-center rounded-full" :style="{ background: brand, color: brandInk }"><AppIcon name="check" class="size-7" /></span>
        <p class="mt-4 text-2xl font-bold">Your program is live</p>
        <p class="mt-1 text-bo-muted">{{ formatMoney(program.pool_balance) }} is in the cashback pool. Print the join poster and connect a counter device.</p>
        <p class="mt-3 text-xs text-bo-muted">Your business key lives in this browser. Link an email or save a backup in Settings so you never lose access.</p>
        <button v-if="emailReady" type="button" class="mt-3 text-sm font-semibold underline underline-offset-4" @click="launched = false; view = 'settings'">Protect access now</button>
        <div class="mt-6 flex justify-center gap-2">
          <button type="button" class="h-11 rounded-lg px-5 font-semibold" :style="{ background: brand, color: brandInk }" @click="launched = false; view = 'devices'">Connect a device</button>
          <button type="button" class="h-11 rounded-lg border border-bo-line px-5 font-semibold hover:bg-bo-bg" @click="launched = false; view = 'join'">Join poster</button>
        </div>
      </div>
    </div>


    <InstallPrompt ref="installPrompt" :context="installContext" :app-name="`${program.name} Dashboard`" :connect-note="connectNote" :auto="!loading && !connectScreen" />
    <ToastStack />
  </div>
</template>
