<script setup lang="ts">
import { computed, ref } from 'vue';
import DateRangePicker, { type DateRange } from '../ui/DateRangePicker.vue';
import SelectMenu from '../ui/SelectMenu.vue';
import { readableTextColor } from '../../lib/format';
import type { BoostInput } from '../../lib/merchant-actions';
import { DAY_NS, localDate, localMidnightNs, offsetLabel } from '../../lib/timezone';

const props = defineProps<{ brand: string; baseBps: number; offsetMinutes: number; initial?: BoostInput | null; saving?: boolean; error?: string }>();
const emit = defineEmits<{ submit: [boost: BoostInput]; cancel: [] }>();

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const whenOptions: { value: number; label: string }[] = [
  { value: -1, label: 'On specific dates' },
  ...[1, 2, 3, 4, 5, 6, 0].map((value) => ({ value, label: `Every ${WEEKDAYS[value]}` })),
];
const latest = Date.now() + 730 * DAY_MS;

const initialSchedule = props.initial?.schedule;
const name = ref(props.initial?.name ?? '');
const when = ref(initialSchedule?.kind === 'weekly' ? initialSchedule.weekday : -1);
const dates = ref<DateRange | null>(
  initialSchedule?.kind === 'range'
    ? {
        from: localDate(initialSchedule.starts_ns, props.offsetMinutes).getTime(),
        to: localDate(initialSchedule.ends_ns - DAY_NS, props.offsetMinutes).getTime(),
      }
    : null,
);
const extra = ref(props.initial ? props.initial.extra_bps / 100 : 3);

const brandInk = computed(() => readableTextColor(props.brand));
const ready = computed(() => !!name.value.trim() && (when.value >= 0 || !!dates.value));
const baseRate = computed(() => props.baseBps / 100);
const total = computed(() => Math.min(25, baseRate.value + extra.value));
const maxExtra = computed(() => Math.max(1, Math.min(15, 25 - baseRate.value)));

const midnight = (time: number) => {
  const date = new Date(time);
  return localMidnightNs(date.getFullYear(), date.getMonth(), date.getDate(), props.offsetMinutes);
};

function submit() {
  if (!ready.value) return;
  const schedule =
    when.value >= 0
      ? { kind: 'weekly' as const, weekday: when.value }
      : {
          kind: 'range' as const,
          starts_ns: midnight(dates.value!.from),
          ends_ns: midnight(dates.value!.to) + DAY_NS,
        };
  emit('submit', { name: name.value.trim(), extra_bps: extra.value * 100, schedule });
}
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-bo-text/30 p-4" role="dialog" aria-modal="true" aria-label="New boost">
    <form class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" @submit.prevent="submit">
      <h2 class="text-xl font-bold">{{ initial?.name ? 'Boost' : 'New boost' }}</h2>
      <label class="mt-4 block text-sm font-semibold">
        Name
        <input v-model="name" required maxlength="40" class="mt-1.5 h-11 w-full rounded-lg border border-bo-line px-3.5 font-normal focus:border-bo-text focus:outline-none" placeholder="Anniversary week" />
      </label>
      <div class="mt-4 grid grid-cols-2 gap-3 text-sm font-semibold">
        <div :class="when >= 0 && 'col-span-2'">
          When
          <SelectMenu v-model="when" class="mt-1.5" :options="whenOptions" label="When" />
        </div>
        <div v-if="when < 0">
          Dates
          <div class="mt-1.5 flex h-10 items-center rounded-lg border border-bo-line bg-white px-1 font-normal">
            <DateRangePicker v-model="dates" :active="false" :max-date="latest" />
          </div>
        </div>
      </div>
      <div class="mt-5 rounded-xl border border-bo-line p-4">
        <div class="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2 text-center">
          <div><p class="text-xs text-bo-muted">Your cashback</p><p class="font-mono text-xl font-bold">{{ baseRate }}%</p></div>
          <p class="pb-1 text-bo-muted">+</p>
          <div><p class="text-xs text-bo-muted">Boost adds</p><p class="font-mono text-xl font-bold" :style="{ color: brand }">{{ extra }}%</p></div>
          <p class="pb-1 text-bo-muted">=</p>
          <div><p class="text-xs text-bo-muted">Customers get</p><p class="font-mono text-2xl font-extrabold">{{ total }}%</p></div>
        </div>
        <input v-model.number="extra" type="range" min="1" :max="maxExtra" class="mt-4 w-full" :style="{ accentColor: brand }" aria-label="Extra cashback added by the boost" />
        <div class="flex justify-between font-mono text-xs text-bo-muted"><span>+1%</span><span>+{{ maxExtra }}% (25% max)</span></div>
      </div>
      <p class="mt-2 text-xs text-bo-muted">Days follow your business time ({{ offsetLabel(offsetMinutes) }}).</p>
      <p v-if="error" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{{ error }}</p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="h-10 rounded-lg border border-bo-line px-4 font-semibold hover:bg-bo-bg" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="h-10 rounded-lg px-5 font-semibold transition hover:brightness-95 disabled:opacity-40" :style="{ background: brand, color: brandInk }" :disabled="saving || !ready">
          {{ saving ? 'Saving…' : 'Save boost' }}
        </button>
      </div>
    </form>
  </div>
</template>
