import { render, screen } from "@testing-library/react"
import { ProblemToVaultSection } from "../problem-to-vault-section"

jest.mock("gsap", () => ({
  __esModule: true,
  default: {
    registerPlugin: jest.fn(),
    timeline: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      fromTo: jest.fn().mockReturnThis(),
      to: jest.fn().mockReturnThis(),
    })),
    set: jest.fn(),
    utils: {
      toArray: jest.fn(() => []),
    },
  },
}))

jest.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {},
}))

jest.mock("@gsap/react", () => ({
  useGSAP: jest.fn(),
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
