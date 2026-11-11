<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';

defineProps<{ title: string; text: string; align?: 'left' | 'right' }>();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

function closeOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeOutside);
  document.addEventListener('keydown', closeOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOutside);
  document.removeEventListener('keydown', closeOnEscape);
});
</script>

<template>
  <span ref="root" class="relative inline-flex align-middle">
    <button
      type="button"
      class="grid size-5 place-items-center rounded-full opacity-60 transition hover:opacity-100"
      :aria-label="`What is ${title}?`"
      :aria-expanded="open"
      @click="open = !open"
    >
      <AppIcon name="info" class="size-3.5" />
    </button>
    <span
      v-if="open"
      role="tooltip"
      class="absolute top-6 z-30 w-64 rounded-xl bg-white p-3 text-left text-xs leading-relaxed font-normal text-ink shadow-xl"
      :class="align === 'left' ? 'left-0' : 'right-0'"
    >
      <span class="block text-sm font-bold">{{ title }}</span>
      <span class="mt-1 block text-ink/70">{{ text }}</span>
    </span>
  </span>
</template>
