<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import BusySpinner from './BusySpinner.vue';
import type { BrowserWallet } from '../../lib/browser-wallet';
import { formatPairingCode } from '../../lib/pairing';
import { adoptShortcutKey, findConnectedAccount, pendingShortcutKey, requestShortcutCode, type ShortcutContext } from '../../lib/shortcut';

const props = defineProps<{ slug: string; context: ShortcutContext; appName: string; place: string; skipLabel?: string }>();
const emit = defineEmits<{
  connected: [accountId: string, adopt: (storageName: string) => Promise<BrowserWallet>];
  skip: [];
}>();

const POLL_MS = 3000;

const code = ref('');
const error = ref('');
let wallet: BrowserWallet | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let finished = false;

async function newCode() {
  if (!wallet) return;
  error.value = '';
  try {
    code.value = await requestShortcutCode(props.slug, wallet);
  } catch {
    error.value = 'Could not get a code. Check the connection and try again.';
  }
}

async function poll() {
  if (!wallet || !code.value || finished) return;
  const accountId = await findConnectedAccount(props.slug, code.value, wallet).catch(() => null);
  if (!accountId || finished) return;
  finished = true;
  clearInterval(timer);
  emit('connected', accountId, (storageName) => adoptShortcutKey(props.context, props.slug, accountId, storageName));
}

onMounted(async () => {
  wallet = await pendingShortcutKey(props.context, props.slug);
  await newCode();
  timer = setInterval(() => poll(), POLL_MS);
});

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section class="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
    <div class="w-full max-w-sm">
      <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-white"><AppIcon name="addSquare" class="size-7" /></span>
      <h1 class="mt-5 text-3xl font-extrabold tracking-tight">Connect this shortcut</h1>
      <p class="mt-2 text-ink/60">
        This home screen app keeps its own storage, so it does not see your {{ appName }} {{ place }} yet. Connect it once with a code.
      </p>
      <ol class="mt-5 space-y-2 text-left text-sm">
        <li class="rounded-xl2 bg-white px-4 py-3 shadow-soft"><b>1.</b> Open Fairly in Safari on this phone and go to your {{ place }}.</li>
        <li class="rounded-xl2 bg-white px-4 py-3 shadow-soft"><b>2.</b> Choose <b>Connect home screen app</b> and type this code.</li>
      </ol>
      <p v-if="code" class="mt-5 rounded-2xl border border-ink/10 bg-white py-5 font-mono text-5xl font-extrabold tracking-[.2em]">{{ formatPairingCode(code) }}</p>
      <p v-else-if="error" class="mt-5 text-sm font-semibold text-red-600">{{ error }}</p>
      <p v-else class="mt-5 flex items-center justify-center gap-2 text-ink/60"><BusySpinner />Getting a code…</p>
      <p class="mt-4 text-xs text-ink/50">The code works for 15 minutes. This screen opens by itself once connected. The key stays on this phone.</p>
      <button type="button" class="mt-4 h-11 rounded-full bg-white px-5 font-semibold shadow-soft" @click="newCode">New code</button>
      <div class="mt-6 flex flex-col items-center gap-2 text-sm font-semibold text-ink/70">
        <slot name="alternatives" />
        <button v-if="skipLabel" type="button" class="underline underline-offset-4" @click="emit('skip')">{{ skipLabel }}</button>
      </div>
    </div>
  </section>
</template>
