import { provider } from '../near';

export const IMPLICIT_ACCOUNT = /^[0-9a-f]{64}$/;

export async function accountExists(accountId: string): Promise<boolean> {
  try {
    await provider.viewAccount({ accountId });
    return true;
  } catch {
    return false;
  }
}
