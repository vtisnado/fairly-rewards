<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import BottomSheet from './BottomSheet.vue';
import { dismissInstall, installDismissed, installModeNow, installState, isMobilePlatform, promptInstall } from '../../lib/install';
import { showToast } from '../../lib/toast';

const props = withDefaults(
  defineProps<{ context: string; appName: string; connectNote?: string; auto?: boolean; tone?: 'light' | 'dark'; raised?: boolean }>(),
  { connectNote: '', auto: false, tone: 'light', raised: false },
);

const sheetOpen = ref(false);
const dismissed = ref(typeof localStorage === 'undefined' ? true : installDismissed(props.context));

const mode = installModeNow;
const showBanner = computed(
  () => props.auto && !dismissed.value && !sheetOpen.value && mode.value !== 'none' && isMobilePlatform(installState.platform),
);

async function open() {
  if (mode.value === 'native') {
    const accepted = await promptInstall();
    if (accepted) showToast('success', 'Added to your home screen');
    return;
  }
  if (mode.value !== 'none') sheetOpen.value = true;
}

function later() {
  dismissInstall(props.context);
  dismissed.value = true;
  sheetOpen.value = false;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('info', 'Link copied', 'Paste it in Safari.');
  } catch {
    showToast('error', 'Could not copy the link', 'Open this page in Safari yourself.');
  }
}

defineExpose({ open });
</script>

<template>
  <div
    v-if="showBanner"
    class="fixed inset-x-3 z-[45] mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3 pl-4 shadow-card ring-1 print:hidden"
    :class="[raised ? 'bottom-28' : 'bottom-3', tone === 'dark' ? 'bg-white text-ink ring-black/10' : 'bg-ink text-white ring-white/10']"
    role="region"
    aria-label="Add to home screen"
  >
    <span class="grid size-10 shrink-0 place-items-center rounded-full bg-coral text-ink"><AppIcon name="addSquare" class="size-5" /></span>
    <p class="min-w-0 flex-1 text-sm leading-snug"><b class="block truncate">Add {{ appName }} to your home screen</b><span class="opacity-60">One tap away, like an app.</span></p>
    <button type="button" class="h-9 shrink-0 rounded-full bg-sun px-4 text-sm font-bold text-ink" @click="open">{{ mode === 'ios-open-safari' ? 'How' : 'Add' }}</button>
    <button type="button" class="h-9 shrink-0 rounded-full px-2 text-sm font-semibold opacity-70 hover:opacity-100" @click="later">Later</button>
  </div>

  <BottomSheet :open="sheetOpen" @close="sheetOpen = false">
    <div v-if="mode === 'ios-sheet'">
      <h3 class="text-3xl font-extrabold tracking-tight">Add {{ appName }} to your home screen</h3>
      <ol class="mt-5 space-y-4">
        <li class="flex items-center gap-4">
          <div class="flex h-14 w-28 shrink-0 items-center justify-around rounded-xl bg-white px-2 text-ink/40 shadow-soft" aria-hidden="true">
            <AppIcon name="back" class="size-4" />
            <span class="grid size-9 place-items-center rounded-lg bg-sky text-[#0A6CFF] ring-2 ring-[#0A6CFF]"><AppIcon name="share" class="size-5" /></span>
            <AppIcon name="book" class="size-4" />
          </div>
          <p class="text-sm"><b class="block">1. Tap Share</b>In the bar at the bottom of Safari.</p>
        </li>
        <li class="flex items-center gap-4">
          <div class="w-28 shrink-0 divide-y divide-ink/10 rounded-xl bg-white text-[10px] font-semibold shadow-soft" aria-hidden="true">
            <p class="px-2 py-1.5 text-ink/40">Add Bookmark</p>
            <p class="flex items-center justify-between bg-[#0A6CFF]/10 px-2 py-1.5 text-[#0A6CFF]">Add to Home Screen<AppIcon name="addSquare" class="size-3.5" /></p>
            <p class="px-2 py-1.5 text-ink/40">Find on Page</p>
          </div>
          <p class="text-sm"><b class="block">2. Add to Home Screen</b>Scroll the list if you do not see it.</p>
        </li>
        <li class="flex items-center gap-4">
          <div class="flex h-14 w-28 shrink-0 items-center justify-between rounded-xl bg-white px-3 text-xs font-semibold shadow-soft" aria-hidden="true">
            <span class="text-ink/40">Cancel</span>
            <span class="rounded-full bg-[#0A6CFF] px-2.5 py-1 text-white">Add</span>
          </div>
          <p class="text-sm"><b class="block">3. Tap Add</b>The icon lands on your home screen.</p>
        </li>
      </ol>
      <p v-if="connectNote" class="mt-5 rounded-xl2 bg-sun-soft px-4 py-3 text-sm">{{ connectNote }}</p>
      <button type="button" class="mt-5 h-14 w-full rounded-full bg-ink font-semibold text-white" @click="sheetOpen = false">Got it</button>
      <button type="button" class="mt-1 h-12 w-full rounded-full font-semibold" @click="later">Later</button>
    </div>
    <div v-else-if="mode === 'ios-open-safari'" class="text-center">
      <span class="mx-auto grid size-16 place-items-center rounded-full bg-sky"><AppIcon name="link" class="size-8" /></span>
      <h3 class="mt-4 text-3xl font-extrabold tracking-tight">Open this page in Safari</h3>
      <p class="mt-2 text-ink/60">On iPhone, Safari is the browser that can add {{ appName }} to your home screen. Copy the link and open it there.</p>
      <button type="button" class="mt-6 h-14 w-full rounded-full bg-ink font-semibold text-white" @click="copyLink">Copy link</button>
      <button type="button" class="mt-1 h-12 w-full rounded-full font-semibold" @click="later">Later</button>
    </div>
  </BottomSheet>
</template>
