import { create } from "zustand"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "criptenv-theme"

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") return stored
  return "system"
}

interface UIState {
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean
  commandPaletteOpen: boolean
  theme: Theme
  resolvedTheme: ResolvedTheme
  toggleSidebar: () => void
  toggleSidebarMobile: () => void
  setSidebarMobileOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  commandPaletteOpen: false,
  theme: getInitialTheme(),
  resolvedTheme: resolveTheme(getInitialTheme()),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleSidebarMobile: () => set((state) => ({ sidebarMobileOpen: !state.sidebarMobileOpen })),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  setTheme: (theme: Theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    set({ theme, resolvedTheme: resolveTheme(theme) })
  },
  toggleTheme: () => {
    const current = get().resolvedTheme
    const next = current === "light" ? "dark" : "light"
    localStorage.setItem(STORAGE_KEY, next)
    set({ theme: next, resolvedTheme: next })
  },
}))
