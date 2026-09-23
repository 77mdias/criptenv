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

// Shared between the next/navigation mock and the @/i18n/navigation mock so a
// test asserting on the mocked `useRouter()` still observes what the component
// did, even though components now import the locale-aware version.
const mockUsePathname = jest.fn(() => "/")
const mockUseRouter = jest.fn(() => router)

function mockLink({
  children,
  href,
  ...props
}: {
  children: React.ReactNode
  href: string
}) {
  return React.createElement("a", { href, ...props }, children)
}

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({})),
  usePathname: mockUsePathname,
  useRouter: mockUseRouter,
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("next/link", () => ({ __esModule: true, default: mockLink }))

// Locale-aware navigation (next-intl createNavigation). Shares the router and
// pathname mocks above; `getPathname` mirrors the as-needed prefixing closely
// enough for unit tests (locale prefixing itself is covered by the e2e smoke).
jest.mock("@/i18n/navigation", () => ({
  __esModule: true,
  Link: mockLink,
  getPathname: jest.fn(({ href }: { href: string }) => href),
  redirect: jest.fn(),
  usePathname: mockUsePathname,
  useRouter: mockUseRouter,
}))

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
