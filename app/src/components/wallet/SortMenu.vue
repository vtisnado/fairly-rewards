<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue';
import type { SortKey } from '../../lib/wallet-cards';

defineProps<{ options: [SortKey, string][]; selected: SortKey }>();
const emit = defineEmits<{ pick: [key: SortKey]; close: [] }>();
</script>

<template>
  <div class="fixed inset-0 z-[55]" @click="emit('close')" />
  <div class="absolute right-0 z-[60] mt-1.5 w-full rounded-xl border border-ink/10 bg-white p-1.5 text-sm font-semibold shadow-card" role="listbox" aria-label="Sort cards">
    <button
      v-for="[key, label] in options"
      :key="key"
      class="flex h-9 w-full items-center justify-between rounded-lg px-3 transition hover:bg-cream"
      role="option"
      :aria-selected="key === selected"
      @click="emit('pick', key)"
    >
      <span>{{ label }}</span>
      <AppIcon v-if="key === selected" name="check" class="size-4" />
    </button>
  </div>
</template>
