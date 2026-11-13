<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import QrCode from '../ui/QrCode.vue';
import type { PassView, ProgramView } from '../../lib/types';
import { formatPercent } from '../../lib/format';
import { cardArtUrl } from '../../lib/wallet-cards';

const props = defineProps<{ program: ProgramView; pass: PassView | null }>();
const emit = defineEmits<{ done: [] }>();

const SLIDES = [
  { title: 'This is your card', text: 'It lives on this phone. It is yours.', background: 'bg-sun-soft' },
  { title: 'Show it when you pay', text: 'One code at the counter. That is it.', background: 'bg-lilac-soft' },
  { title: 'Money lands on it', text: `${formatPercent(props.program.cashback_bps)} of every purchase. Spend it or sell the card.`, background: 'bg-mint-soft' },
];

const slide = ref(0);
const finishIntro = () => emit('done');
</script>

<template>
    <section class="relative flex h-full flex-col pt-12 pb-8 transition-colors duration-500" :class="SLIDES[slide]!.background">
  <button class="mr-6 self-end text-sm font-semibold opacity-60 transition hover:opacity-100" @click="finishIntro">Skip</button>
  <div class="flex-1 overflow-hidden">
    <div class="flex h-full transition-transform duration-500 ease-[cubic-bezier(.22,.8,.2,1)]" :style="{ transform: `translateX(-${slide * 100}%)` }">
      <div v-for="(item, index) in SLIDES" :key="item.title" class="flex w-full shrink-0 flex-col px-6">
        <div class="grid flex-1 place-items-center">
          <img v-if="index === 0" :src="pass ? cardArtUrl(pass) : `/api/art/${program.slug}/0.svg?balance=0&purchases=0`" alt="Your card" class="w-full rounded-[20px] shadow-card" />
          <div v-else-if="index === 1" class="size-60 rounded-2xl bg-white p-4 shadow-card"><QrCode value="fairly:c:intro" label="Example code" /></div>
          <p v-else class="text-7xl font-extrabold tracking-tight">+{{ formatPercent(program.effective_cashback_bps) }}</p>
        </div>
        <h2 class="text-4xl leading-none font-extrabold tracking-tight">{{ item.title }}</h2>
        <p class="mt-2 text-lg opacity-75">{{ item.text }}</p>
      </div>
    </div>
  </div>
  <div class="mt-8 flex items-center justify-between px-6">
    <div class="flex gap-1.5">
      <button
        v-for="index in SLIDES.length"
        :key="index"
        class="h-2 rounded-full transition-all duration-300"
        :class="index - 1 === slide ? 'w-7 bg-ink' : 'w-2 bg-ink/25'"
        :aria-label="`Slide ${index}`"
        @click="slide = index - 1"
      />
    </div>
    <button
      class="grid size-16 place-items-center rounded-full bg-ink text-white transition hover:scale-105 active:scale-95"
      aria-label="Next"
      @click="slide < SLIDES.length - 1 ? slide++ : finishIntro()"
    >
      <AppIcon name="arrow" class="size-7" />
    </button>
  </div>
</section>
</template>
