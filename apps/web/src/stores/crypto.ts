import { create } from "zustand"

/**
 * Crypto store — holds encryption keys in memory ONLY.
 * NEVER persisted to localStorage/sessionStorage.
 * Keys are lost on page refresh (user must re-enter password).
 */
interface CryptoState {
  projectId: string | null
  keyMaterial: CryptoKey | null
  vaultProof: string | null
  isUnlocked: boolean
  unlockedAt: string | null
  unlockProject: (projectId: string, keyMaterial: CryptoKey, vaultProof: string) => void
  clearSession: () => void
}

export const useCryptoStore = create<CryptoState>((set) => ({
  projectId: null,
  keyMaterial: null,
  vaultProof: null,
  isUnlocked: false,
  unlockedAt: null,
  unlockProject: (projectId, keyMaterial, vaultProof) =>
    set({
      projectId,
      keyMaterial,
      vaultProof,
      isUnlocked: true,
      unlockedAt: new Date().toISOString(),
    }),
  clearSession: () =>
    set({
      projectId: null,
      keyMaterial: null,
      vaultProof: null,
      isUnlocked: false,
      unlockedAt: null,
    }),
}))
