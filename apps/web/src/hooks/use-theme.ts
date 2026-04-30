"use client"

import { useEffect } from "react"
import { useUIStore } from "@/stores/ui"

export function useTheme() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useUIStore()

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [resolvedTheme])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      if (theme === "system") {
        useUIStore.setState({ resolvedTheme: mediaQuery.matches ? "dark" : "light" })
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  return { theme, resolvedTheme, setTheme, toggleTheme }
}
