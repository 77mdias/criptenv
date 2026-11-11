import { screen } from "@testing-library/react"

import { meApi } from "@/lib/api"
import type { OverviewResponse } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { renderWithIntl } from "@/test/render-with-intl"

import SecurityPage from "../page"

jest.mock("@/lib/api", () => ({
  meApi: { overview: jest.fn(), credentials: jest.fn() },
}))

const overview: OverviewResponse = {
  projects: [],
  attention: { expired: [], expiring: [], pending_invites: [], stale_credentials: [], failing_integrations: [] },
  totals: { projects: 0, secrets: 0, members: 0 },
}

function signIn(twoFactor: boolean) {
  useAuthStore.setState({
    user: { id: "u1", email: "a@x.com", name: "Ana", kdf_salt: "s", avatar_url: null, two_factor_enabled: twoFactor },
    isAuthenticated: true,
  })
}

beforeEach(() => {
  jest.mocked(meApi.overview).mockResolvedValue(overview)
  jest.mocked(meApi.credentials).mockResolvedValue({ credentials: [] })
})

describe("SecurityPage", () => {
  it("puts 2FA off at the top with a link to the account", async () => {
    signIn(false)
    renderWithIntl(<SecurityPage />)

    expect(await screen.findByText("Nota 70 de 100")).toBeInTheDocument()
    expect(screen.getByText("Autenticação 2FA desligada")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ligar na conta" })).toHaveAttribute("href", "/account")
  })

  it("shows 100 and the all-good message when nothing is wrong", async () => {
    signIn(true)
    renderWithIntl(<SecurityPage />)

    expect(await screen.findByText("Nota 100 de 100")).toBeInTheDocument()
    expect(screen.getByText("Tudo em ordem")).toBeInTheDocument()
  })
})
