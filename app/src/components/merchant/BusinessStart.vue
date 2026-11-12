<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import SetupWizard from './SetupWizard.vue';
import { saveWallet, walletFromSecret } from '../../lib/browser-wallet';
import { loadMerchant } from '../../lib/merchant-actions';
import { viewFairly } from '../../lib/near';
import type { ProgramView } from '../../lib/types';

const props = defineProps<{ demoSlug: string; startWizard: boolean }>();
const MERCHANT_KEY = 'fairly.merchant.key';

const programs = ref<ProgramView[]>([]);
const checking = ref(true);
const creating = ref(props.startWizard);
const restoreText = ref('');
const restoreError = ref('');

const programsOf = (accountId: string) => viewFairly<ProgramView[]>('get_programs_by_owner', { account_id: accountId });

async function restore() {
  restoreError.value = '';
  try {
    const wallet = walletFromSecret(restoreText.value);
    const owned = await programsOf(wallet.accountId);
    if (!owned.length) {
      restoreError.value = 'That key does not own a program.';
      return;
    }
    saveWallet(MERCHANT_KEY, wallet);
    window.location.href = `/business/${owned[0]!.slug}`;
  } catch {
    restoreError.value = 'That does not look like a business key.';
  }
}

function openLaunched(slug: string) {
  window.location.href = `/business/${slug}?launched=1`;
}

async function readFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) restoreText.value = (await file.text()).trim();
}

onMounted(async () => {
  const wallet = loadMerchant();
  if (wallet) programs.value = await programsOf(wallet.accountId).catch(() => []);
  checking.value = false;
  if (programs.value.length) window.location.replace(`/business/${programs.value[0]!.slug}`);
});
</script>

<template>
  <div class="min-h-[calc(100dvh-1.75rem)]">
    <header class="flex h-16 items-center gap-2 border-b border-bo-line bg-white px-6">
      <span class="grid size-8 place-items-center rounded-full bg-coral text-sm font-black text-ink">F</span>
      <span class="text-xl font-extrabold tracking-tight">Fairly</span>
      <span class="text-xs font-semibold text-bo-muted">Business</span>
      <a v-if="creating" href="/business" class="ml-auto text-sm font-semibold text-bo-muted hover:text-bo-text">Cancel</a>
    </header>

    <p v-if="checking" class="p-8 text-sm text-bo-muted">Checking this browser for your business…</p>
    <SetupWizard v-else-if="creating" @launched="openLaunched" />

    <main v-else class="mx-auto max-w-3xl p-8">
      <h1 class="text-3xl font-extrabold tracking-tight">Loyalty cards with real money inside</h1>
      <p class="mt-2 text-bo-muted">Give customers cashback they can spend at your counter. Set it up in five steps with test money on NEAR testnet.</p>

      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <a href="/business/new" class="rounded-xl bg-bo-text p-6 text-white transition hover:bg-black">
          <AppIcon name="plus" class="size-6" />
          <p class="mt-4 text-lg font-bold">Register your business</p>
          <p class="text-sm text-white/70">Brand, rewards, locations and test money. About two minutes.</p>
        </a>
        <a :href="`/business/${demoSlug}`" class="rounded-xl border border-bo-line bg-white p-6 transition hover:border-bo-muted">
          <AppIcon name="cup" class="size-6" />
          <p class="mt-4 text-lg font-bold">Explore the demo café</p>
          <p class="text-sm text-bo-muted">A shared program with live data. Some settings are locked.</p>
        </a>
      </div>

      <details class="mt-8 rounded-xl border border-bo-line bg-white p-5">
        <summary class="cursor-pointer font-semibold">Already registered? Restore your business key</summary>
        <p class="mt-2 text-sm text-bo-muted">Paste the key you downloaded from Settings, or pick the file.</p>
        <textarea v-model="restoreText" rows="2" class="mt-3 w-full rounded-lg border border-bo-line p-3 font-mono text-xs focus:border-bo-text focus:outline-none" placeholder="ed25519:…" aria-label="Business key" />
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <label class="flex h-10 cursor-pointer items-center rounded-lg border border-bo-line px-4 text-sm font-semibold hover:bg-bo-bg">
            Pick file<input type="file" accept=".txt,text/plain" class="hidden" @change="readFile" />
          </label>
          <button type="button" class="h-10 rounded-lg bg-bo-text px-4 text-sm font-semibold text-white disabled:opacity-40" :disabled="!restoreText" @click="restore">Restore</button>
        </div>
        <p v-if="restoreError" class="mt-2 text-sm font-semibold text-red-600" role="alert">{{ restoreError }}</p>
      </details>
    </main>
  </div>
</template>
