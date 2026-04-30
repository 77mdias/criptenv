import { create } from "zustand"

/**
 * Crypto store — holds encryption keys in memory ONLY.
 * NEVER persisted to localStorage/sessionStorage.
 * Keys are lost on page refresh (user must re-enter password).
 */
interface CryptoState {
  sessionKey: CryptoKey | null
  isAuthenticated: boolean
  setSessionKey: (key: CryptoKey | null) => void
  clearSession: () => void
}

export const useCryptoStore = create<CryptoState>((set) => ({
  sessionKey: null,
  isAuthenticated: false,
  setSessionKey: (key) => set({ sessionKey: key, isAuthenticated: key !== null }),
  clearSession: () => set({ sessionKey: null, isAuthenticated: false }),
}))
