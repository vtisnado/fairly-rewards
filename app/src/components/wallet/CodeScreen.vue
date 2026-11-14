<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import QrCode from '../ui/QrCode.vue';
import type { BrowserWallet } from '../../lib/browser-wallet';
import { CODE_TTL_SECONDS, customerQrPayload, formatCustomerCode } from '../../lib/customer-code';
import { requestCustomerCode } from '../../lib/customer-code-client';

const props = defineProps<{ wallet: BrowserWallet }>();
const emit = defineEmits<{ back: [] }>();

const ROTATE_AHEAD_SECONDS = 2;
const RETRY_MS = 4000;

const token = ref('');
const code = ref('');
const left = ref(CODE_TTL_SECONDS);
const offline = ref(false);
const failure = ref('');
const fetching = ref(false);
const ring = ref<SVGRectElement | null>(null);

let expiresAt = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let wakeLock: WakeLockSentinel | null = null;
let generation = 0;

const expired = computed(() => !token.value || left.value <= 0);
const countdown = computed(() => `${Math.floor(left.value / 60)}:${String(left.value % 60).padStart(2, '0')}`);
const typedCode = computed(() => formatCustomerCode(code.value));
const payload = computed(() => customerQrPayload(token.value));

function syncRing() {
  const element = ring.value;
  if (!element) return;
  element.style.animation = 'none';
  void element.getBoundingClientRect();
  element.style.animation = '';
  element.style.animationDelay = `-${CODE_TTL_SECONDS - left.value}s`;
}

function tick() {
  left.value = token.value ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;
  if (!fetching.value && !offline.value && left.value <= ROTATE_AHEAD_SECONDS) void rotate();
}

async function rotate() {
  if (fetching.value) return;
  fetching.value = true;
  const mine = ++generation;
  try {
    const issued = await requestCustomerCode(props.wallet);
    if (mine !== generation) return;
    token.value = issued.token;
    code.value = issued.code;
    expiresAt = Date.now() + issued.expiresInSeconds * 1000;
    left.value = issued.expiresInSeconds;
    offline.value = false;
    syncRing();
  } catch (cause) {
    if (mine !== generation) return;
    failure.value = navigator.onLine && cause instanceof Error ? cause.message : '';
    offline.value = true;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      offline.value = false;
      void rotate();
    }, RETRY_MS);
  } finally {
    fetching.value = false;
  }
}

async function keepAwake() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null;
  }
}

function onVisibility() {
  if (document.hidden) {
    clearInterval(timer);
    timer = undefined;
    return;
  }
  void keepAwake();
  startTicking();
}

function startTicking() {
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  tick();
  syncRing();
}

function refreshNow() {
  clearTimeout(retryTimer);
  offline.value = false;
  void rotate();
}

defineExpose({ refreshNow });

onMounted(() => {
  void rotate();
  void keepAwake();
  startTicking();
  document.addEventListener('visibilitychange', onVisibility);
});

onBeforeUnmount(() => {
  clearInterval(timer);
  clearTimeout(retryTimer);
  generation++;
  document.removeEventListener('visibilitychange', onVisibility);
  void wakeLock?.release().catch(() => undefined);
});
</script>

<template>
  <section class="absolute inset-0 z-50 flex flex-col bg-ink px-6 pt-8 pb-8 text-white" aria-label="Your code">
    <div class="flex items-center justify-between">
      <button class="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Back" @click="emit('back')">
        <AppIcon name="back" class="size-5" />
      </button>
    </div>
    <p class="mt-6 text-3xl leading-none font-extrabold tracking-tight">Show this<br />at the counter</p>

    <div class="relative mx-auto mt-6 aspect-square w-full max-w-[300px]">
      <div class="absolute inset-[2.17%] rounded-[6.58%] bg-white p-[8%]" :class="expired && 'opacity-40'">
        <QrCode v-if="token" :value="payload" label="QR code for the counter" />
      </div>
      <svg viewBox="0 0 120 120" class="pointer-events-none absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <rect
          ref="ring"
          class="ring"
          x="1.5"
          y="1.5"
          width="117"
          height="117"
          rx="9"
          fill="none"
          :stroke="left < 30 ? '#FFD84D' : '#F2654F'"
          stroke-width="3"
          pathLength="100"
          stroke-dasharray="100"
        />
      </svg>
    </div>

    <div class="mt-6 text-center">
      <p class="text-sm text-white/50">Or tell the cashier</p>
      <p class="mt-1 text-5xl font-extrabold tracking-[.12em] tabular-nums" aria-label="Typed code">{{ typedCode || '···-···' }}</p>
      <p v-if="offline" class="mt-3 px-2 text-sm font-semibold text-sun" role="status">
        {{ failure ? `Could not get a new code (${failure}). Retrying…` : 'You are offline.' }} {{ expired ? 'This code ran out.' : 'This code works until the timer ends.' }}
        <button v-if="expired" class="underline underline-offset-4" @click="refreshNow">Refresh</button>
      </p>
      <p v-else class="mt-3 px-2 text-sm text-white/60">
        New code in <b class="tabular-nums text-white">{{ countdown }}</b
        >. Screenshots stop working when the timer runs out.
      </p>
    </div>

    <div class="mt-auto flex items-center gap-3 rounded-xl2 bg-white/10 p-4">
      <span class="grid size-11 place-items-center rounded-full bg-sun text-ink"><AppIcon name="bolt" class="size-5" /></span>
      <div class="flex-1">
        <p class="leading-tight font-semibold">Raise your brightness</p>
        <p class="text-sm text-white/60">The counter reads it faster</p>
      </div>
    </div>
  </section>
</template>
