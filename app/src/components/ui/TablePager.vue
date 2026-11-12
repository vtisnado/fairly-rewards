<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ total: number; pageSize: number; noun: string }>();
const page = defineModel<number>({ required: true });
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const first = computed(() => (props.total ? page.value * props.pageSize + 1 : 0));
const last = computed(() => Math.min(props.total, (page.value + 1) * props.pageSize));
</script>

<template>
  <div class="flex items-center justify-between gap-3 text-sm">
    <span class="text-bo-muted">{{ first }}–{{ last }} of {{ total }} {{ noun }}</span>
    <div class="flex items-center gap-1">
      <button type="button" class="grid size-8 rotate-90 place-items-center rounded-md border border-bo-line hover:bg-bo-bg disabled:opacity-30" :disabled="page === 0" aria-label="Previous page" @click="page--">
        <AppIcon name="chevron" class="size-4" />
      </button>
      <span class="min-w-14 text-center font-mono text-xs text-bo-muted">{{ page + 1 }} / {{ pages }}</span>
      <button type="button" class="grid size-8 -rotate-90 place-items-center rounded-md border border-bo-line hover:bg-bo-bg disabled:opacity-30" :disabled="page >= pages - 1" aria-label="Next page" @click="page++">
        <AppIcon name="chevron" class="size-4" />
      </button>
    </div>
  </div>
</template>
