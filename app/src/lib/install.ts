import { computed, reactive } from 'vue';

export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'desktop';
export type InstallMode = 'native' | 'ios-sheet' | 'ios-open-safari' | 'none';

interface PromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface NavigatorFacts {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

const IOS_OTHER_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\//;
const DISMISS_PREFIX = 'fairly.install.later';

export function detectPlatform({ userAgent, platform = '', maxTouchPoints = 0 }: NavigatorFacts): InstallPlatform {
  const iPadAsMac = platform === 'MacIntel' && maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(userAgent) || iPadAsMac) return IOS_OTHER_BROWSERS.test(userAgent) ? 'ios-other' : 'ios-safari';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

export function installMode(platform: InstallPlatform, canPrompt: boolean, standalone: boolean): InstallMode {
  if (standalone) return 'none';
  if (canPrompt) return 'native';
  if (platform === 'ios-safari') return 'ios-sheet';
  if (platform === 'ios-other') return 'ios-open-safari';
  return 'none';
}

export const isMobilePlatform = (platform: InstallPlatform) => platform !== 'desktop';

export const dismissKey = (context: string) => `${DISMISS_PREFIX}.${context}`;

const state = reactive({
  platform: 'desktop' as InstallPlatform,
  standalone: false,
  canPrompt: false,
  ready: false,
});

let deferred: PromptEvent | null = null;
let started = false;

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function startInstallDetection() {
  if (started || typeof window === 'undefined') return;
  started = true;
  state.platform = detectPlatform(navigator);
  state.standalone = isStandalone();
  state.ready = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as PromptEvent;
    state.canPrompt = true;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    state.canPrompt = false;
    state.standalone = true;
  });
}

startInstallDetection();

export const installState = state;

export const currentInstallMode = (): InstallMode => installMode(state.platform, state.canPrompt, state.standalone);

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  state.canPrompt = false;
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

export const installDismissed = (context: string) => localStorage.getItem(dismissKey(context)) !== null;

export const dismissInstall = (context: string) => localStorage.setItem(dismissKey(context), '1');

export const installModeNow = computed(() => currentInstallMode());
