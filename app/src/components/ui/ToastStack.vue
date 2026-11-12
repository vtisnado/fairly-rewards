<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { dismissToast, toasts } from '../../lib/toast';

const STYLES = {
  success: { box: 'bg-[#0F5132] text-white', badge: 'bg-white/20', icon: 'check' },
  error: { box: 'bg-[#B42318] text-white', badge: 'bg-white/20', icon: 'info' },
  info: { box: 'bg-[#17161A] text-white', badge: 'bg-white/15', icon: 'info' },
} as const;
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-10 z-[100] flex flex-col items-center gap-2 px-4 print:hidden" aria-live="assertive" aria-atomic="false">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex w-full max-w-md animate-[toast-in_.25s_cubic-bezier(.2,.8,.2,1)] items-start gap-3 rounded-2xl px-4 py-3.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,.45)] ring-1 ring-black/10"
      :class="STYLES[toast.kind].box"
      :role="toast.kind === 'error' ? 'alert' : 'status'"
    >
      <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full" :class="STYLES[toast.kind].badge"><AppIcon :name="STYLES[toast.kind].icon" class="size-4" /></span>
      <div class="min-w-0 flex-1">
        <p class="font-bold leading-snug">{{ toast.title }}</p>
        <p v-if="toast.detail" class="mt-0.5 text-sm leading-snug text-white/85">{{ toast.detail }}</p>
      </div>
      <button type="button" class="-mr-1 grid size-7 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white" aria-label="Dismiss" @click="dismissToast(toast.id)">✕</button>
    </div>
  </div>
</template>

<style scoped>
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.97);
  }
}
</style>
