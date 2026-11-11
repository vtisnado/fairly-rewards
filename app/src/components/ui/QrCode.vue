<script setup lang="ts">
import { computed } from 'vue';
import { renderSVG } from 'uqr';

const props = defineProps<{ value: string }>();
const svg = computed(() => renderSVG(props.value, { border: 1, pixelSize: 8, blackColor: '#17161A', whiteColor: '#FFFFFF' }));
</script>

<template>
  <div class="[&>svg]:h-full [&>svg]:w-full" role="img" :aria-label="`QR code for ${value}`" v-html="svg" />
</template>
