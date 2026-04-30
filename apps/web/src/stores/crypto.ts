import { create } from "zustand"

/**
 * Crypto store — holds encryption keys in memory ONLY.
 * NEVER persisted to localStorage/sessionStorage.
 * Keys are lost on page refresh (user must re-enter password).
 */
interface CryptoState {
  sessionKey: CryptoKey | null
  isUnlocked: boolean
  unlockedAt: string | null
  setSessionKey: (key: CryptoKey | null) => void
  clearSession: () => void
}

export const useCryptoStore = create<CryptoState>((set) => ({
  sessionKey: null,
  isUnlocked: false,
  unlockedAt: null,
  setSessionKey: (key) =>
    set({
      sessionKey: key,
      isUnlocked: key !== null,
      unlockedAt: key ? new Date().toISOString() : null,
    }),
  clearSession: () => set({ sessionKey: null, isUnlocked: false, unlockedAt: null }),
}))
