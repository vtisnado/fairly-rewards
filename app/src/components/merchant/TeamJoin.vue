<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { getProgram } from '../../lib/near';
import { formatPairingCode, localKey, requestPairing } from '../../lib/pairing';
import { subscribeToEvents, type FairlyEvent } from '../../lib/realtime';
import type { ProgramView } from '../../lib/types';

const props = defineProps<{ program: ProgramView }>();
const code = ref('');
const error = ref('');
let unsubscribe = () => {};
const wallet = localKey('manager', props.program.slug);
const dashboard = `/business/${props.program.slug}`;

const isManager = (program: ProgramView | null) => !!program?.managers.some((manager) => manager.account_id === wallet.accountId);

async function newCode() {
  error.value = '';
  try {
    code.value = await requestPairing(props.program.slug, 'manager', wallet.accountId);
  } catch {
    error.value = 'Could not get a code. Check the connection and try again.';
  }
}

async function onEvent(event: FairlyEvent) {
  if (event.event === 'manager_added' && event.data.account_id === wallet.accountId && isManager(await getProgram(props.program.slug))) {
    window.location.href = dashboard;
  }
}

onMounted(() => {
  if (isManager(props.program)) {
    window.location.replace(dashboard);
    return;
  }
  newCode();
  unsubscribe = subscribeToEvents({ column: 'program_slug', value: props.program.slug, onEvent, onState: () => undefined });
});

onBeforeUnmount(() => unsubscribe());
</script>

<template>
  <main class="grid min-h-[calc(100dvh-1.75rem)] place-items-center p-6 text-center">
    <div class="max-w-sm">
      <span class="mx-auto grid size-14 place-items-center rounded-2xl" :style="{ background: program.brand_color }"><AppIcon name="users" class="size-7 text-white" /></span>
      <h1 class="mt-5 text-2xl font-bold">Join the {{ program.name }} team</h1>
      <p class="mt-2 text-bo-muted">Give this code to the owner. They type it in Settings, under Team.</p>
      <p v-if="code" class="mt-6 rounded-2xl border border-bo-line bg-white py-5 font-mono text-5xl font-extrabold tracking-[.2em]">{{ formatPairingCode(code) }}</p>
      <p v-else-if="error" class="mt-6 text-sm font-semibold text-red-600">{{ error }}</p>
      <p v-else class="mt-6 text-bo-muted">Getting a code…</p>
      <p class="mt-4 text-xs text-bo-muted">The code works for 15 minutes. This page opens the dashboard by itself once you are added. Your manager key stays in this browser.</p>
      <button type="button" class="mt-6 h-11 rounded-lg border border-bo-line bg-white px-5 font-semibold hover:bg-bo-bg" @click="newCode">New code</button>
    </div>
  </main>
</template>
