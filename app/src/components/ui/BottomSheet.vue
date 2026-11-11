<script setup lang="ts">
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-200 ease-in"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/50" @click.self="emit('close')">
      <div class="sheet w-full max-w-[440px] rounded-t-xl3 bg-cream px-6 pt-3 pb-8">
        <span class="mx-auto mb-5 block h-1.5 w-12 rounded-full bg-ink/15" />
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet {
  animation: sheet 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}

@keyframes sheet {
  from {
    transform: translateY(100%);
  }
  to {
    transform: none;
  }
}
</style>
