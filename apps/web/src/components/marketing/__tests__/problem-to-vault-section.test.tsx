import { render, screen } from "@testing-library/react"
import { ProblemToVaultSection } from "../problem-to-vault-section"

jest.mock("gsap", () => ({
  __esModule: true,
  default: {
    registerPlugin: jest.fn(),
    context: jest.fn((fn: () => void) => {
      fn()
      return { revert: jest.fn() }
    }),
    from: jest.fn(),
    fromTo: jest.fn(),
    set: jest.fn(),
    utils: {
      toArray: jest.fn(() => []),
    },
  },
}))

jest.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    create: jest.fn(),
  },
}))

describe("ProblemToVaultSection", () => {
  it("renders the vault ceremony copy and technical proof points", () => {
    render(<ProblemToVaultSection />)

    expect(
      screen.getByRole("heading", {
        name: /Do \.env solto ao vault selado/i,
      }),
    ).toBeInTheDocument()

    expect(screen.getByText("plain env")).toBeInTheDocument()
    expect(screen.getByText("AES-GCM local seal")).toBeInTheDocument()
    expect(screen.getByText("encrypted vault")).toBeInTheDocument()
    expect(screen.getByText("server sees: ciphertext")).toBeInTheDocument()
    expect(screen.getByText("plaintext: never")).toBeInTheDocument()
    expect(screen.getByText("audit hash: chained")).toBeInTheDocument()
  })
})
