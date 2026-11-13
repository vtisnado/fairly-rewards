import { reactive } from 'vue';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

const DURATION_MS: Record<ToastKind, number> = { success: 4000, info: 5000, error: 9000 };

export const toasts = reactive<Toast[]>([]);
let nextId = 1;

export function dismissToast(id: number) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) toasts.splice(index, 1);
}

export function showToast(kind: ToastKind, title: string, detail?: string) {
  const id = nextId++;
  toasts.push({ id, kind, title, detail });
  if (toasts.length > 3) toasts.shift();
  setTimeout(() => dismissToast(id), DURATION_MS[kind]);
}

const CODES: Record<string, string> = {
  CHAIN_ERROR: 'The network did not accept the transaction. Wait a few seconds and try again.',
  RELAY_FAILED: 'The network did not accept the transaction. Wait a few seconds and try again.',
  RATE_LIMITED: 'Too many tries from this connection. Try again in a while.',
  INSUFFICIENT_BALANCE: 'The card does not have enough balance.',
  PAUSED: 'This program is paused right now.',
  LISTED: 'This card is listed for sale. Cancel the listing first.',
  ALREADY_HAS_PASS: 'You already have a card from this shop.',
  ACCOUNT_NOT_READY: 'Your new account is still being created on the network. Try again in a few seconds.',
  PAIRING_NOT_FOUND: 'That code was not found or expired. Ask the home screen app for a new one.',
  INVALID_SHORTCUT_CODE: 'That code was not found or expired. Ask the home screen app for a new one.',
  REQUEST_FAILED: 'The server did not answer. Check the connection and try again.',
};

export function errorDetail(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  const code = message.match(/[A-Z]+(?:_[A-Z]+)+/)?.[0];
  if (code && CODES[code]) return CODES[code]!;
  if (message.startsWith('NEAR Auth') || message.includes(' ')) return message;
  return code ? `Error code ${code}.` : 'Something unexpected happened. Try again.';
}

export const showError = (step: string, cause: unknown) => showToast('error', `Could not ${step}`, errorDetail(cause));
