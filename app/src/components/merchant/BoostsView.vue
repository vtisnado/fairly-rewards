<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import BoostForm from './BoostForm.vue';
import { showToast } from '../../lib/toast';
import { BOOST_PRESETS } from '../../lib/boost-presets';
import { localDate } from '../../lib/timezone';
import { formatPercent, readableTextColor } from '../../lib/format';
import { actionError, type BoostInput, type MerchantActions } from '../../lib/merchant-actions';
import type { Boost, ProgramView } from '../../lib/types';

const props = defineProps<{ program: ProgramView; actions: MerchantActions }>();
const emit = defineEmits<{ changed: []; notice: [text: string] }>();

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_OPTIONS = [3, 6, 12];

const months = ref(3);
const busyId = ref<number | null>(null);
const formOpen = ref(false);
const formInitial = ref<BoostInput | null>(null);
const editingId = ref<number | null>(null);
const saving = ref(false);
const formError = ref('');

const brand = computed(() => props.program.brand_color);
const brandInk = computed(() => readableTextColor(brand.value));

const shortDate = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
const offset = computed(() => props.program.utc_offset_minutes);

function describe(boost: Boost) {
  if (boost.schedule.kind === 'weekly') return `Every ${WEEKDAYS[boost.schedule.weekday]}`;
  const from = localDate(boost.schedule.starts_ns, offset.value);
  const to = localDate(boost.schedule.ends_ns - 1_000_000, offset.value);
  return from.getTime() === to.getTime() ? shortDate(from) : `${shortDate(from)} to ${shortDate(to)}`;
}

function boostOn(day: Date): Boost | null {
  const time = day.getTime();
  return (
    props.program.boosts.find((boost) => {
      if (boost.schedule.kind === 'weekly') return day.getDay() === boost.schedule.weekday;
      const from = localDate(boost.schedule.starts_ns, offset.value).getTime();
      const to = localDate(boost.schedule.ends_ns - 1_000_000, offset.value).getTime();
      return time >= from && time <= to;
    }) ?? null
  );
}

const calendar = computed(() => {
  const today = new Date();
  return Array.from({ length: months.value }, (_, offset) => {
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const blanks = (first.getDay() + 6) % 7;
    return {
      title: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(first),
      days: [
        ...Array.from({ length: blanks }, () => null),
        ...Array.from({ length: count }, (_, index) => {
          const date = new Date(first.getFullYear(), first.getMonth(), index + 1);
          return { n: index + 1, today: date.toDateString() === today.toDateString(), boost: boostOn(date) };
        }),
      ],
    };
  });
});

async function toggle(boost: Boost) {
  busyId.value = boost.id;
  try {
    await props.actions.setBoostEnabled(boost.id, !boost.enabled);
    emit('notice', `${boost.name} ${boost.enabled ? 'paused' : 'turned on'}`);
    emit('changed');
  } catch (cause) {
    showToast('error', 'Could not update the boost', actionError(cause));
  } finally {
    busyId.value = null;
  }
}

async function remove(boost: Boost) {
  busyId.value = boost.id;
  try {
    await props.actions.removeBoost(boost.id);
    emit('notice', `${boost.name} removed`);
    emit('changed');
  } catch (cause) {
    showToast('error', 'Could not update the boost', actionError(cause));
  } finally {
    busyId.value = null;
  }
}

const suggestions = computed(() =>
  BOOST_PRESETS.filter((preset) => !props.program.boosts.some((boost) => boost.name.toLowerCase() === preset.name.toLowerCase())),
);

function openForm(initial: BoostInput | null = null, boostId: number | null = null) {
  formInitial.value = initial;
  editingId.value = boostId;
  formOpen.value = true;
  formError.value = '';
}

async function save(boost: BoostInput) {
  saving.value = true;
  formError.value = '';
  try {
    await props.actions.addBoost(boost);
    if (editingId.value !== null) await props.actions.removeBoost(editingId.value);
    emit('notice', `${boost.name} ${editingId.value !== null ? 'updated' : 'created'}`);
    emit('changed');
    formOpen.value = false;
  } catch (cause) {
    formError.value = actionError(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="p-8">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-2xl font-bold">Boosts</h1>
      <div class="flex rounded-lg border border-bo-line bg-white p-1 text-sm font-semibold">
        <button
          v-for="count in MONTH_OPTIONS"
          :key="count"
          type="button"
          class="h-8 rounded-md px-3 transition"
          :class="months === count ? 'bg-bo-text text-white' : 'text-bo-muted hover:text-bo-text'"
          @click="months = count"
        >
          {{ count }} months
        </button>
      </div>
      <button type="button" class="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition hover:brightness-95" :style="{ background: brand, color: brandInk }" @click="openForm()">
        <AppIcon name="plus" class="size-4" />New boost
      </button>
    </div>
    <p class="mt-2 text-sm text-bo-muted">Raise cashback for a date range or a recurring slow day. Boosts add to the base {{ formatPercent(program.cashback_bps) }} (max 25%) and stop on their own.</p>

    <div class="mt-5 grid gap-4" :class="months === 3 ? 'md:grid-cols-3' : 'md:grid-cols-3 xl:grid-cols-4'">
      <div v-for="month in calendar" :key="month.title" class="rounded-xl border border-bo-line bg-white p-4">
        <p class="font-bold">{{ month.title }}</p>
        <div class="mt-3 grid grid-cols-7 text-center text-[10px] font-semibold text-bo-muted">
          <span v-for="(letter, index) in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="index">{{ letter }}</span>
        </div>
        <div class="mt-1 grid grid-cols-7 gap-0.5">
          <template v-for="(day, index) in month.days" :key="index">
            <span v-if="!day" />
            <div
              v-else
              class="grid h-8 place-items-center rounded-md font-mono text-[11px]"
              :class="day.today && 'ring-2 ring-bo-text'"
              :style="day.boost ? { background: day.boost.enabled ? brand : `${brand}33`, color: day.boost.enabled ? brandInk : '#1C1B1F' } : {}"
              :title="day.boost ? `${day.boost.name} +${formatPercent(day.boost.extra_bps)}` : ''"
            >
              {{ day.n }}
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-bo-muted">
      <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: brand }" />Active boost</span>
      <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" :style="{ background: `${brand}33` }" />Paused boost</span>
      <span class="flex items-center gap-1.5"><span class="size-3 rounded-sm ring-2 ring-bo-text" />Today</span>
    </div>

    <p v-if="!program.boosts.length" class="mt-6 rounded-xl border border-dashed border-bo-line p-6 text-center text-sm text-bo-muted">No boosts yet. Start from a suggestion below or create your own.</p>
    <div class="mt-6 grid gap-4 md:grid-cols-2">
      <div v-for="boost in program.boosts" :key="boost.id" class="flex items-center gap-4 rounded-xl border border-bo-line bg-white p-5">
        <span class="grid size-12 shrink-0 place-items-center rounded-lg" :style="boost.enabled ? { background: brand, color: brandInk } : { background: '#F4F4F2', color: '#6E6B73' }">
          <AppIcon name="calendar" class="size-6" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold">{{ boost.name }}</p>
          <p class="text-sm text-bo-muted">{{ describe(boost) }} · {{ formatPercent(program.cashback_bps) }} + {{ formatPercent(boost.extra_bps) }} = <b class="text-bo-text">{{ formatPercent(Math.min(2500, program.cashback_bps + boost.extra_bps)) }}</b></p>
        </div>
        <span class="font-mono text-sm font-bold">+{{ formatPercent(boost.extra_bps) }}</span>
        <button
          type="button"
          role="switch"
          :aria-checked="boost.enabled"
          :aria-label="`Turn ${boost.name} ${boost.enabled ? 'off' : 'on'}`"
          class="relative h-[22px] w-10 shrink-0 rounded-full transition disabled:opacity-40"
          :style="{ background: boost.enabled ? brand : '#D9D6D0' }"
          :disabled="busyId === boost.id"
          @click="toggle(boost)"
        >
          <span class="absolute top-[3px] size-4 rounded-full bg-white transition-all" :class="boost.enabled ? 'left-[21px]' : 'left-[3px]'" />
        </button>
        <button
          type="button"
          class="h-8 rounded-md border border-bo-line px-2.5 text-xs font-semibold transition hover:border-bo-muted disabled:opacity-40"
          :disabled="busyId === boost.id"
          @click="openForm({ name: boost.name, extra_bps: boost.extra_bps, schedule: boost.schedule }, boost.id)"
        >
          Edit
        </button>
        <button type="button" class="text-bo-muted hover:text-red-600 disabled:opacity-40" :disabled="busyId === boost.id" :aria-label="`Remove ${boost.name}`" @click="remove(boost)">✕</button>
      </div>
    </div>

    <BoostForm v-if="formOpen" :brand="brand" :base-bps="program.cashback_bps" :offset-minutes="program.utc_offset_minutes" :initial="formInitial" :saving="saving" :error="formError" @submit="save" @cancel="formOpen = false" />
    <div v-if="suggestions.length" class="mt-8">
      <h2 class="font-bold">Suggestions</h2>
      <p class="text-sm text-bo-muted">Off until you add them. You can change the dates and the extra cashback first.</p>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="preset in suggestions" :key="preset.name" class="flex items-center gap-3 rounded-xl border border-dashed border-bo-line bg-white/60 p-4">
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-bo-bg text-bo-muted"><AppIcon name="calendar" class="size-5" /></span>
          <div class="min-w-0 flex-1"><p class="font-semibold">{{ preset.name }}</p><p class="text-xs text-bo-muted">{{ preset.hint }}</p></div>
          <button type="button" class="h-8 shrink-0 rounded-md border border-bo-line bg-white px-3 text-xs font-semibold transition hover:border-bo-muted" @click="openForm(preset.build(program.utc_offset_minutes))">Use</button>
        </div>
      </div>
    </div>

  </section>
</template>
