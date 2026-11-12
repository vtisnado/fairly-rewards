<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';

export interface DateRange {
  from: number;
  to: number;
}

const props = defineProps<{ active: boolean; maxDate?: number }>();
const model = defineModel<DateRange | null>({ required: true });
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const month = ref(firstOfMonth(Date.now()));
const start = ref<number | null>(null);
const hover = ref<number | null>(null);
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function firstOfMonth(time: number) {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

const shortDate = (time: number) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(time);
const title = computed(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month.value));
const buttonLabel = computed(() => (model.value ? `${shortDate(model.value.from)} – ${shortDate(model.value.to)}` : 'Custom'));
const limit = computed(() => props.maxDate ?? Date.now());

const days = computed(() => {
  const first = new Date(month.value);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index + 1).getTime()),
  ];
});

function move(step: number) {
  const date = new Date(month.value);
  month.value = new Date(date.getFullYear(), date.getMonth() + step, 1).getTime();
}

function state(day: number) {
  const end = start.value !== null ? hover.value ?? start.value : null;
  const from = start.value !== null ? Math.min(start.value, end!) : model.value?.from;
  const to = start.value !== null ? Math.max(start.value, end!) : model.value?.to;
  if (from === undefined || to === undefined) return '';
  if (day === from || day === to) return 'selected';
  return day > from && day < to ? 'inside' : '';
}

function pick(day: number) {
  if (start.value === null) {
    start.value = day;
    return;
  }
  model.value = { from: Math.min(start.value, day), to: Math.max(start.value, day) };
  start.value = null;
  open.value = false;
}

function toggle() {
  open.value = !open.value;
  start.value = null;
  if (open.value) month.value = firstOfMonth(model.value?.to ?? Date.now());
}

function closeOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeOutside);
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOutside);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex h-8 items-center gap-1.5 rounded-md px-3 transition"
      :class="active ? 'bg-bo-text text-white' : 'text-bo-muted hover:text-bo-text'"
      :aria-expanded="open"
      @click="toggle"
    >
      <AppIcon name="calendar" class="size-4" />{{ buttonLabel }}
    </button>
    <div v-if="open" class="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-bo-line bg-white p-4 text-bo-text shadow-[0_16px_40px_-16px_rgba(0,0,0,.25)]">
      <div class="flex items-center justify-between">
        <button type="button" class="grid size-8 rotate-90 place-items-center rounded-md hover:bg-bo-bg" aria-label="Previous month" @click="move(-1)"><AppIcon name="chevron" class="size-4" /></button>
        <p class="text-sm font-bold">{{ title }}</p>
        <button
          type="button"
          class="grid size-8 -rotate-90 place-items-center rounded-md hover:bg-bo-bg disabled:opacity-30"
          aria-label="Next month"
          :disabled="month >= firstOfMonth(limit)"
          @click="move(1)"
        >
          <AppIcon name="chevron" class="size-4" />
        </button>
      </div>
      <div class="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold text-bo-muted">
        <span v-for="weekday in WEEKDAYS" :key="weekday">{{ weekday }}</span>
      </div>
      <div class="mt-1 grid grid-cols-7" @mouseleave="hover = null">
        <template v-for="(day, index) in days" :key="index">
          <span v-if="day === null" />
          <button
            v-else
            type="button"
            class="h-8.5 font-mono text-[13px] transition disabled:opacity-25"
            :class="{
              'rounded-md bg-bo-text text-white': state(day) === 'selected',
              'bg-bo-bg': state(day) === 'inside',
              'rounded-md hover:bg-bo-bg': !state(day),
            }"
            :disabled="day > limit"
            @mouseenter="hover = day"
            @click="pick(day)"
          >
            {{ new Date(day).getDate() }}
          </button>
        </template>
      </div>
      <p class="mt-3 text-xs text-bo-muted">{{ start === null ? 'Pick a start date.' : 'Now pick the end date.' }}</p>
    </div>
  </div>
</template>
