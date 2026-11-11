<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

const emit = defineEmits<{ detected: [value: string]; unavailable: [reason: string] }>();
const video = ref<HTMLVideoElement | null>(null);
let stream: MediaStream | null = null;
let frame = 0;

function stop() {
  cancelAnimationFrame(frame);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

onMounted(async () => {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector || !navigator.mediaDevices?.getUserMedia) {
    emit('unavailable', 'This browser cannot scan codes. Type the card code instead.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    emit('unavailable', 'Camera permission was denied. Type the card code instead.');
    return;
  }
  if (!video.value) return;
  video.value.srcObject = stream;
  await video.value.play();
  const detector = new Detector({ formats: ['qr_code'] });
  const scan = async () => {
    if (!video.value) return;
    const [code] = await detector.detect(video.value).catch(() => []);
    if (code?.rawValue) {
      stop();
      emit('detected', code.rawValue);
      return;
    }
    frame = requestAnimationFrame(scan);
  };
  scan();
});

onBeforeUnmount(stop);
</script>

<template>
  <video ref="video" class="absolute inset-0 size-full object-cover" muted playsinline />
</template>
