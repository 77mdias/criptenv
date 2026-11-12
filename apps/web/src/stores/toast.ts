import { create } from "zustand"

interface ToastState {
  message: string | null
  // Bumped on every show so a repeated message restarts the toast instead of being ignored.
  id: number
  show: (message: string) => void
  dismiss: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  id: 0,
  show: (message) => set((state) => ({ message, id: state.id + 1 })),
  dismiss: () => set({ message: null }),
}))

export const toast = (message: string) => useToastStore.getState().show(message)
