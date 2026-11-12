<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

defineProps<{ title: string; subtitle?: string }>();
const emit = defineEmits<{ close: [] }>();

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" :aria-label="title">
    <button type="button" class="absolute inset-0 animate-[fade_.2s_ease] bg-bo-text/30" aria-label="Close" @click="emit('close')" />
    <aside class="absolute inset-y-0 right-0 flex w-full max-w-md animate-[slide_.25s_cubic-bezier(.2,.8,.2,1)] flex-col bg-white shadow-2xl">
      <header class="flex items-start justify-between gap-3 border-b border-bo-line px-6 py-5">
        <div class="min-w-0">
          <h2 class="truncate text-xl font-bold">{{ title }}</h2>
          <p v-if="subtitle" class="truncate text-sm text-bo-muted">{{ subtitle }}</p>
        </div>
        <button type="button" class="grid size-9 shrink-0 place-items-center rounded-lg border border-bo-line text-bo-muted hover:text-bo-text" aria-label="Close" @click="emit('close')">✕</button>
      </header>
      <div class="flex-1 overflow-y-auto px-6 py-5"><slot /></div>
    </aside>
  </div>
</template>

<style scoped>
@keyframes fade {
  from { opacity: 0; }
}
@keyframes slide {
  from { transform: translateX(100%); }
}
</style>
