<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import MapView from './MapView.vue';
import { placeAt, searchPlaces, shortAddress, type Place } from '../../lib/geocoding';

const props = defineProps<{ color: string; label: string; others?: { id: string; label: string; lat: number; lng: number }[] }>();
const model = defineModel<Place | null>({ required: true });
const query = ref(model.value ? shortAddress(model.value.address) : '');
const results = ref<Place[]>([]);
const searching = ref(false);
const resolving = ref(false);
let timer = 0;

watch(model, (place) => {
  if (!place) query.value = '';
});
let controller: AbortController | null = null;

const pins = computed(() => [
  ...(props.others ?? []),
  ...(model.value ? [{ id: 'new', label: props.label || 'New location', lat: model.value.lat, lng: model.value.lng }] : []),
]);

function search() {
  clearTimeout(timer);
  const text = query.value.trim();
  if (text.length < 3) {
    results.value = [];
    return;
  }
  timer = window.setTimeout(async () => {
    controller?.abort();
    controller = new AbortController();
    searching.value = true;
    try {
      results.value = await searchPlaces(text, controller.signal);
    } catch {
      results.value = [];
    } finally {
      searching.value = false;
    }
  }, 500);
}

function choose(place: Place) {
  model.value = place;
  query.value = shortAddress(place.address);
  results.value = [];
}

async function pinAt(lat: number, lng: number) {
  model.value = { address: model.value?.address ?? '', lat, lng };
  resolving.value = true;
  try {
    const place = await placeAt(lat, lng);
    model.value = place;
    query.value = shortAddress(place.address);
  } finally {
    resolving.value = false;
  }
}

onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
});
</script>

<template>
  <div>
    <div class="relative">
      <AppIcon name="pin" class="absolute top-3.5 left-3 size-4 text-bo-muted" />
      <input
        v-model="query"
        class="h-11 w-full rounded-lg border border-bo-line pr-3 pl-9 focus:border-bo-text focus:outline-none"
        placeholder="Search an address"
        aria-label="Search an address"
        autocomplete="off"
        @input="search"
        @keydown.enter.prevent="results[0] && choose(results[0])"
      />
      <ul v-if="results.length" class="absolute z-[1000] mt-1.5 w-full rounded-xl border border-bo-line bg-white p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,.25)]">
        <li v-for="place in results" :key="`${place.lat},${place.lng}`">
          <button type="button" class="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-bo-bg" @click="choose(place)">
            <span class="block font-semibold">{{ shortAddress(place.address) }}</span>
            <span class="block truncate text-xs text-bo-muted">{{ place.address }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="searching" class="mt-1.5 text-xs text-bo-muted">Searching…</p>
    </div>
    <div class="mt-3 h-64">
      <MapView :pins="pins" :color="color" selected-id="new" interactive @pick="pinAt" @move="(_, lat, lng) => pinAt(lat, lng)" />
    </div>
    <p class="mt-2 text-xs text-bo-muted">
      {{ resolving ? 'Finding the address…' : model ? 'Drag the pin or tap the map to adjust it.' : 'Search an address or tap the map to drop a pin.' }}
    </p>
  </div>
</template>
