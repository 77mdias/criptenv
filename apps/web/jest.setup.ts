import "@testing-library/jest-dom"
import React from "react"
import { webcrypto } from "node:crypto"

const router = {
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  push: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
}

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
  useRouter: jest.fn(() => router),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
}) {
    return React.createElement("a", { href, ...props }, children)
  }
})

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
  })
}

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    addEventListener: jest.fn(),
    addListener: jest.fn(),
    dispatchEvent: jest.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: jest.fn(),
    removeListener: jest.fn(),
  })),
})

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    readText: jest.fn(),
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

class ResizeObserverMock {
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock,
})

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

export { router as mockRouter }
