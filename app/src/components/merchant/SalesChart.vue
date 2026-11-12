<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatMoney } from '../../lib/format';

const props = defineProps<{ series: { day: number; cents: number }[]; previous?: { day: number; cents: number }[]; color: string }>();
const WIDTH = 600;
const HEIGHT = 220;
const hovered = ref<number | null>(null);

const maxCents = computed(() => {
  const peak = Math.max(...props.series.map((point) => point.cents), ...(props.previous ?? []).map((point) => point.cents), 0);
  const step = peak <= 1000 ? 500 : peak <= 10_000 ? 2500 : 10_000;
  return Math.max(step, Math.ceil(peak / step) * step);
});
const ticks = computed(() => [0, 0.5, 1].map((share) => Math.round(maxCents.value * share)));
const xOf = (index: number) => (props.series.length > 1 ? (index / (props.series.length - 1)) * WIDTH : WIDTH / 2);
const yOf = (cents: number) => HEIGHT - (cents / maxCents.value) * HEIGHT;
const pathOf = (points: { cents: number }[]) => points.map((point, index) => `${index ? 'L' : 'M'}${xOf(index)},${yOf(point.cents)}`).join(' ');
const line = computed(() => pathOf(props.series));
const previousLine = computed(() => (props.previous ? pathOf(props.previous) : ''));
const area = computed(() => `${line.value} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`);
const money = (cents: number) => formatMoney(String(cents * 10_000));
const dayLabel = (time: number) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(time);
const labels = computed(() => {
  const count = props.series.length;
  if (!count) return [];
  const indexes = [0, Math.floor((count - 1) / 2), count - 1];
  return [...new Set(indexes)].map((index) => ({ left: (xOf(index) / WIDTH) * 100, text: dayLabel(props.series[index]!.day) }));
});
const point = computed(() => (hovered.value === null ? null : props.series[hovered.value] ?? null));

function hover(event: MouseEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  hovered.value = Math.round(share * (props.series.length - 1));
}
</script>

<template>
  <div>
    <div class="grid grid-cols-[56px_1fr] gap-2">
      <div class="relative h-56 font-mono text-[11px] text-bo-muted">
        <span v-for="tick in ticks" :key="tick" class="absolute right-0 -translate-y-1/2" :style="{ top: `${100 - (tick / maxCents) * 100}%` }">{{ money(tick) }}</span>
      </div>
      <div class="relative h-56" @mousemove="hover" @mouseleave="hovered = null">
        <div v-for="tick in ticks" :key="tick" class="absolute inset-x-0 border-t border-dashed border-bo-line" :style="{ top: `${100 - (tick / maxCents) * 100}%` }" />
        <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="absolute inset-0 size-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
          <path :d="area" :fill="color" fill-opacity=".1" />
          <path v-if="previousLine" :d="previousLine" stroke="#8A8790" stroke-width="1.75" stroke-dasharray="6 5" fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          <path :d="line" :stroke="color" stroke-width="2.5" fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        </svg>
        <template v-if="point && hovered !== null">
          <div class="absolute inset-y-0 w-px bg-bo-text/30" :style="{ left: `${(xOf(hovered) / WIDTH) * 100}%` }" />
          <div
            class="absolute -mt-1.5 -ml-1.5 size-3 rounded-full border-2 border-white shadow"
            :style="{ left: `${(xOf(hovered) / WIDTH) * 100}%`, top: `${(yOf(point.cents) / HEIGHT) * 100}%`, background: color }"
          />
          <div
            class="pointer-events-none absolute -mt-3 -translate-x-1/2 -translate-y-full rounded-lg bg-bo-text px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
            :style="{ left: `${Math.min(88, Math.max(12, (xOf(hovered) / WIDTH) * 100))}%`, top: `${(yOf(point.cents) / HEIGHT) * 100}%` }"
          >
            <p class="text-white/60">{{ dayLabel(point.day) }}</p>
            <p class="font-mono text-sm font-bold">{{ money(point.cents) }}</p>
            <p v-if="previous?.[hovered]" class="font-mono text-white/60">Previous {{ money(previous[hovered]!.cents) }}</p>
          </div>
        </template>
      </div>
      <span />
      <div class="relative h-5 font-mono text-[11px] text-bo-muted">
        <span v-for="label in labels" :key="label.left" class="absolute -translate-x-1/2 whitespace-nowrap" :style="{ left: `${label.left}%` }">{{ label.text }}</span>
      </div>
    </div>
    <div class="mt-3 flex gap-5 text-xs font-semibold text-bo-muted">
      <span class="flex items-center gap-1.5"><span class="h-1 w-3 rounded" :style="{ background: color }" />Member sales</span>
      <span v-if="previous" class="flex items-center gap-1.5"><span class="w-4 border-t-2 border-dashed border-[#8A8790]" />Previous period</span>
      <span class="ml-auto font-normal">Hover the chart to see each value</span>
    </div>
  </div>
</template>
