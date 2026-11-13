<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import BottomSheet from '../ui/BottomSheet.vue';
import BusySpinner from '../ui/BusySpinner.vue';
import ToastStack from '../ui/ToastStack.vue';
import IntroSlides from './IntroSlides.vue';
import type { PassView, ProgramView } from '../../lib/types';
import { getPassesByOwner } from '../../lib/near';
import { businessTypeOf } from '../../lib/business-types';
import { formatPercent } from '../../lib/format';
import { createWallet, loadWallet } from '../../lib/customer-wallet';
import { nearAuthAvailable } from '../../lib/near-auth';
import { showError } from '../../lib/toast';
import { useRecovery } from '../../lib/use-recovery';

const props = defineProps<{ program: ProgramView }>();

const INTRO_SEEN_KEY = 'fairly.intro.seen';
const screen = ref<'join' | 'intro'>('join');
const issued = ref<PassView | null>(null);
const checking = ref(true);
const busy = ref(false);
const businessIcon = businessTypeOf(props.program.mcc).icon;
const emailReady = nearAuthAvailable();
const tiers = computed(() => props.program.tiers);

const goToWallet = (joined?: string) => window.location.assign(joined ? `/wallet?joined=${encodeURIComponent(joined)}` : '/wallet');

const recovery = useRecovery(() => goToWallet());

async function join() {
  if (busy.value) return;
  busy.value = true;
  try {
    const wallet = (await loadWallet()) ?? (await createWallet());
    const response = await fetch('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: props.program.slug, accountId: wallet.accountId }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(body.error ?? 'JOIN_FAILED');
    if (localStorage.getItem(INTRO_SEEN_KEY)) {
      goToWallet(props.program.slug);
      return;
    }
    issued.value = (await getPassesByOwner(wallet.accountId).catch(() => [])).find((card) => card.program_slug === props.program.slug) ?? null;
    screen.value = 'intro';
    busy.value = false;
  } catch (cause) {
    showError('add your card', cause);
    busy.value = false;
  }
}

function finishIntro() {
  localStorage.setItem(INTRO_SEEN_KEY, '1');
  goToWallet(props.program.slug);
}

onMounted(async () => {
  const wallet = await loadWallet().catch(() => null);
  const cards = wallet ? await getPassesByOwner(wallet.accountId).catch(() => []) : [];
  if (cards.some((card) => card.program_slug === props.program.slug)) {
    goToWallet();
    return;
  }
  checking.value = false;
});
</script>

<template>
  <div class="relative mx-auto flex min-h-[calc(100dvh-1.75rem)] max-w-[440px] flex-col overflow-hidden bg-cream">
    <div v-if="checking" class="grid flex-1 place-items-center text-ink/50">Loading…</div>

    <div v-else-if="screen === 'intro'" class="h-[calc(100dvh-1.75rem)]"><IntroSlides :program="program" :pass="issued" @done="finishIntro" /></div>

    <section v-else class="relative flex flex-1 flex-col overflow-hidden bg-ink px-6 pt-10 pb-8 text-cream">
      <div class="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full opacity-25 blur-3xl" :style="{ background: program.brand_color }" />
      <div class="relative flex items-center gap-2 font-semibold">
        <span class="grid size-9 place-items-center rounded-full text-ink" :style="{ background: program.brand_color }"><AppIcon :name="businessIcon" class="size-5" /></span>
        {{ program.name }}
      </div>
      <div class="relative mt-6 aspect-[1.15] w-full">
        <img
          :src="`/api/art/${program.slug}/2.svg?balance=12400000&purchases=${tiers[2]?.min_purchases ?? 0}`"
          alt=""
          class="float absolute top-0 left-0 w-[86%] -rotate-6 rounded-[20px] shadow-card ring-1 ring-white/10"
        />
        <img
          :src="`/api/art/${program.slug}/0.svg?balance=1250000&purchases=1`"
          alt=""
          class="float absolute right-0 bottom-0 w-[86%] rotate-3 rounded-[20px] shadow-card ring-1 ring-white/10 [animation-delay:-2s]"
        />
      </div>
      <h1 class="relative mt-8 text-[44px] leading-[.95] font-extrabold tracking-tight">
        Get <span :style="{ color: program.brand_color }">{{ formatPercent(program.effective_cashback_bps) }}</span> back.<br />Every visit.
      </h1>
      <p class="relative mt-3 text-lg text-cream/70">Your card keeps the money.</p>
      <button
        class="relative mt-auto flex h-16 shrink-0 items-center justify-between rounded-full bg-cream pr-2 pl-7 text-lg font-semibold text-ink transition active:scale-[.98] disabled:opacity-70"
        :disabled="busy"
        @click="join"
      >
        <span class="flex items-center gap-3">
          <span v-if="busy" class="size-5 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink" aria-hidden="true" />
          {{ busy ? 'Adding your card…' : 'Get my card' }}
        </span>
        <span class="grid size-12 place-items-center rounded-full bg-sun text-ink"><AppIcon name="arrow" class="size-6" /></span>
      </button>
      <p class="relative mt-3 text-center text-sm text-cream/60">No app. No sign-up. <span class="font-mono text-xs opacity-70">(demo · test money)</span></p>
      <label class="relative mt-2 cursor-pointer text-center text-sm font-semibold text-cream/70 underline underline-offset-4">
        I have a backup file
        <input type="file" accept=".txt,text/plain" class="hidden" @change="recovery.restoreFromFile" />
      </label>
      <button
        v-if="emailReady"
        class="relative mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-cream/70 underline underline-offset-4 disabled:opacity-50"
        :disabled="recovery.busy.value"
        @click="recovery.recoverByEmail"
      >
        <BusySpinner v-if="recovery.busy.value" />{{ recovery.busy.value ? 'Waiting for NEAR Auth…' : 'Recover my wallet with email' }}
      </button>
    </section>

    <BottomSheet :open="recovery.pending.value !== null" @close="recovery.cancelRecovery()">
      <div v-if="recovery.pending.value" class="text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-mint"><AppIcon name="check" class="size-8" /></span>
        <h3 class="mt-4 text-3xl font-extrabold tracking-tight">Wallet found</h3>
        <p class="mt-2 text-ink/60">
          Signed in{{ recovery.pending.value.email ? ` as ${recovery.pending.value.email}` : '' }}. One more step: approve adding this browser to your wallet. NEAR Auth opens again to confirm.
        </p>
        <button
          class="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink font-semibold text-white disabled:opacity-50"
          :disabled="recovery.busy.value"
          @click="recovery.approveRecovery"
        >
          <BusySpinner v-if="recovery.busy.value" />{{ recovery.busy.value ? 'Recovering your wallet…' : 'Approve with NEAR Auth' }}
        </button>
        <button class="mt-2 h-12 w-full rounded-full font-semibold" :disabled="recovery.busy.value" @click="recovery.cancelRecovery()">Cancel</button>
      </div>
    </BottomSheet>
    <ToastStack />
  </div>
</template>

<style scoped>
.float {
  animation: float 5s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -12px;
  }
}
</style>
