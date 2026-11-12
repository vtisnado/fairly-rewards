<script setup lang="ts">
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

export interface MapPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

const props = defineProps<{ pins: MapPin[]; color: string; selectedId?: string | null; interactive?: boolean }>();
const emit = defineEmits<{ pick: [lat: number, lng: number]; move: [id: string, lat: number, lng: number] }>();
const container = ref<HTMLElement | null>(null);
const DEFAULT_CENTER: L.LatLngTuple = [20, 0];
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;

const pinIcon = (color: string, label: string) =>
  L.divIcon({
    className: '',
    iconSize: [36, 46],
    iconAnchor: [18, 44],
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <span style="position:absolute;bottom:48px;white-space:nowrap;background:#fff;border-radius:6px;padding:2px 8px;font:600 12px Outfit,sans-serif;box-shadow:0 4px 12px -4px rgba(0,0,0,.3)">${label.replace(/[<>&]/g, '')}</span>
      <svg viewBox="0 0 24 24" width="36" height="46" style="color:${color};filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="currentColor"/><circle cx="12" cy="9.5" r="2.5" fill="#fff"/></svg>
    </div>`,
  });

const placed = (pin: MapPin) => pin.lat !== 0 || pin.lng !== 0;

function draw(fit: boolean) {
  if (!map || !layer) return;
  layer.clearLayers();
  const visible = props.pins.filter(placed);
  for (const pin of visible) {
    const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(props.color, pin.label), draggable: props.interactive && pin.id === props.selectedId });
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      emit('move', pin.id, lat, lng);
    });
    marker.addTo(layer);
  }
  if (!fit) return;
  const focus = visible.find((pin) => pin.id === props.selectedId);
  if (focus) map.setView([focus.lat, focus.lng], 16);
  else if (visible.length === 1) map.setView([visible[0]!.lat, visible[0]!.lng], 15);
  else if (visible.length > 1) map.fitBounds(L.latLngBounds(visible.map((pin) => [pin.lat, pin.lng])), { padding: [60, 60], maxZoom: 15 });
}

onMounted(() => {
  if (!container.value) return;
  map = L.map(container.value, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  if (props.interactive) map.on('click', (event: L.LeafletMouseEvent) => emit('pick', event.latlng.lat, event.latlng.lng));
  draw(true);
});

watch(
  () => [props.pins, props.selectedId, props.color],
  (current, previous) => draw(JSON.stringify(current[0]) !== JSON.stringify(previous?.[0]) || current[1] !== previous?.[1]),
  { deep: true },
);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
</script>

<template>
  <div ref="container" class="relative z-0 size-full overflow-hidden rounded-xl border border-bo-line bg-[#EEF0EC]" />
</template>
