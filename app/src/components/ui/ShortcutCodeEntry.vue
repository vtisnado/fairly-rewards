<script setup lang="ts">
import { ref } from 'vue';
import BusySpinner from './BusySpinner.vue';
import type { BrowserWallet } from '../../lib/browser-wallet';
import { connectShortcut } from '../../lib/shortcut';
import { errorDetail, showToast } from '../../lib/toast';

const props = defineProps<{ slug: string; wallet: BrowserWallet | null }>();
const emit = defineEmits<{ done: [] }>();

const code = ref('');
const busy = ref(false);
const error = ref('');

async function submit() {
  if (!props.wallet || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await connectShortcut(props.wallet, props.slug, code.value.toUpperCase().replace(/[^0-9A-Z]/g, ''));
    code.value = '';
    showToast('success', 'Home screen app connected', 'It opens by itself in a few seconds.');
    emit('done');
  } catch (cause) {
    error.value = errorDetail(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="text-left" @submit.prevent="submit">
    <label class="block text-sm font-semibold" for="shortcut-code">Code shown on the home screen app</label>
    <div class="mt-2 flex gap-2">
      <input
        id="shortcut-code"
        v-model="code"
        class="h-11 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-coral focus:outline-none"
        placeholder="ABC-123"
        maxlength="7"
        autocomplete="off"
        autocapitalize="characters"
        :disabled="!wallet"
      />
      <button class="flex h-11 items-center gap-2 rounded-lg bg-ink px-5 font-semibold text-white disabled:opacity-40" :disabled="!wallet || busy || code.replace(/[^0-9A-Za-z]/g, '').length < 6">
        <BusySpinner v-if="busy" />{{ busy ? 'Connecting…' : 'Connect' }}
      </button>
    </div>
    <p v-if="error" class="mt-2 text-sm font-semibold text-red-600" role="alert">{{ error }}</p>
  </form>
</template>
