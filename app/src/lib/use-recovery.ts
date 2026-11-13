import { ref } from 'vue';
import { CUSTOMER_STORAGE_KEY, restoreWallet, type CustomerWallet } from './customer-wallet';
import { nearAuthMessage, startRecovery, type PendingRecovery } from './near-auth';
import { showToast } from './toast';

export function useRecovery(onRecovered: (wallet: CustomerWallet) => void | Promise<void>) {
  const busy = ref(false);
  const pending = ref<PendingRecovery | null>(null);

  async function restoreFromFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await onRecovered(await restoreWallet(await file.text()));
    } catch {
      showToast('error', 'Could not restore the backup', 'That file is not a Fairly backup.');
    } finally {
      input.value = '';
    }
  }

  async function recoverByEmail() {
    if (busy.value) return;
    busy.value = true;
    try {
      pending.value = await startRecovery('customer', CUSTOMER_STORAGE_KEY);
    } catch (cause) {
      showToast('error', 'Could not find your wallet', nearAuthMessage(cause));
    } finally {
      busy.value = false;
    }
  }

  async function approveRecovery() {
    if (!pending.value || busy.value) return;
    busy.value = true;
    try {
      const wallet = await pending.value.approve();
      pending.value = null;
      await onRecovered(wallet);
      showToast('success', 'Wallet recovered', 'This browser can use your cards again.');
    } catch (cause) {
      showToast('error', 'Could not finish the recovery', nearAuthMessage(cause));
    } finally {
      busy.value = false;
    }
  }

  const cancelRecovery = () => {
    pending.value = null;
  };

  return { busy, pending, restoreFromFile, recoverByEmail, approveRecovery, cancelRecovery };
}
