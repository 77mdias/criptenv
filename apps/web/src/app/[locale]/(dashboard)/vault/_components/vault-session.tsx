"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export const PERSONAL_VAULT_IDLE_MS = 600_000

interface PersonalVaultSession {
  vaultKey: CryptoKey | null
  unlock: (key: CryptoKey) => void
  lock: () => void
}

const SessionContext = createContext<PersonalVaultSession | null>(null)

/**
 * Holds the unlocked vault key in memory only — never a store, storage or
 * cache. Leaving the /vault route unmounts this provider and drops the key;
 * components that show decrypted data render only while it is set, so locking
 * unmounts them and their plaintext with them.
 */
export function PersonalVaultSessionProvider({ children }: { children: ReactNode }) {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null)
  const lock = useCallback(() => setVaultKey(null), [])

  useEffect(() => {
    if (!vaultKey) return
    let timer = setTimeout(lock, PERSONAL_VAULT_IDLE_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(lock, PERSONAL_VAULT_IDLE_MS)
    }
    window.addEventListener("pointerdown", reset)
    window.addEventListener("keydown", reset)
    // Leaving the page may park it in the back-forward cache with its JS heap; lock first.
    window.addEventListener("pagehide", lock)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("pointerdown", reset)
      window.removeEventListener("keydown", reset)
      window.removeEventListener("pagehide", lock)
    }
  }, [vaultKey, lock])

  const value = useMemo(() => ({ vaultKey, unlock: setVaultKey, lock }), [vaultKey, lock])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function usePersonalVaultSession(): PersonalVaultSession {
  const session = useContext(SessionContext)
  if (!session) throw new Error("usePersonalVaultSession must be used inside PersonalVaultSessionProvider")
  return session
}
