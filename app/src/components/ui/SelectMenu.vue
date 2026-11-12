<script setup lang="ts" generic="T extends string | number">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import type { IconName } from '../../lib/icons';

const props = defineProps<{ options: { value: T; label: string }[]; label: string; icon?: IconName }>();
const model = defineModel<T>({ required: true });
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const current = computed(() => props.options.find((option) => option.value === model.value)?.label ?? props.label);

function pick(value: T) {
  model.value = value;
  open.value = false;
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
      class="flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm font-semibold transition"
      :class="open ? 'border-bo-text ring-3 ring-bo-text/10' : 'border-bo-line hover:border-bo-muted'"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open = !open"
    >
      <span class="flex min-w-0 items-center gap-2"><AppIcon v-if="icon" :name="icon" class="size-4 shrink-0" /><span class="truncate">{{ current }}</span></span>
      <AppIcon name="chevron" class="size-4 shrink-0 transition" :class="open && 'rotate-180'" />
    </button>
    <ul v-if="open" role="listbox" class="absolute z-40 mt-1.5 w-full min-w-44 rounded-xl border border-bo-line bg-white p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,.25)]">
      <li v-for="option in options" :key="option.value">
        <button
          type="button"
          role="option"
          :aria-selected="option.value === model"
          class="flex h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm hover:bg-bo-bg"
          @click="pick(option.value)"
        >
          <span>{{ option.label }}</span>
          <AppIcon v-if="option.value === model" name="check" class="size-4" />
        </button>
      </li>
    </ul>
  </div>
</template>
