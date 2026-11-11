<script setup lang="ts">
import { ICONS, type IconName } from '../../lib/icons';

defineProps<{ name: IconName }>();
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true" v-html="ICONS[name]" />
</template>
