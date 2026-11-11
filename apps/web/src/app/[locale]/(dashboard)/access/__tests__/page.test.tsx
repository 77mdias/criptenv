import { fireEvent, screen, waitFor, within } from "@testing-library/react"

import { apiKeysApi, ciTokensApi, meApi } from "@/lib/api"
import type { Credential } from "@/lib/api/me"
import { renderWithIntl } from "@/test/render-with-intl"

import AccessPage from "../page"

jest.mock("@/lib/api", () => ({
  meApi: { credentials: jest.fn() },
  ciTokensApi: { revoke: jest.fn() },
  apiKeysApi: { revoke: jest.fn() },
}))

const credential = (overrides: Partial<Credential>): Credential => ({
  kind: "ci_token",
  id: "c1",
  project_id: "p1",
  project_name: "api",
  name: "deploy",
  scopes: ["read:secrets"],
  environment_scope: null,
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
  created_at: null,
  status: "active",
  no_expiry: true,
  unused: false,
  ...overrides,
})

describe("AccessPage", () => {
  it("lists active credentials by default and flags the ones with no expiry", async () => {
    jest.mocked(meApi.credentials).mockResolvedValue({
      credentials: [
        credential({}),
        credential({ id: "k1", kind: "api_key", name: "reader", no_expiry: false }),
        credential({ id: "c2", name: "old", status: "revoked", no_expiry: false }),
      ],
    })
    renderWithIntl(<AccessPage />)

    const deploy = await screen.findByRole("article", { name: "deploy" })
    expect(within(deploy).getByText("Sem expiração")).toBeInTheDocument()
    expect(screen.getByRole("article", { name: "reader" })).toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "old" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "revoked" } })
    expect(screen.getByRole("article", { name: "old" })).toBeInTheDocument()
    expect(within(screen.getByRole("article", { name: "old" })).queryByRole("button")).not.toBeInTheDocument()
  })

  it("revokes with the matching API after confirming, then reloads", async () => {
    jest.mocked(meApi.credentials).mockResolvedValue({
      credentials: [credential({}), credential({ id: "k1", kind: "api_key", name: "reader", no_expiry: false })],
    })
    renderWithIntl(<AccessPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Revogar reader" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Revogar" }))

    await waitFor(() => expect(apiKeysApi.revoke).toHaveBeenCalledWith("p1", "k1"))
    expect(ciTokensApi.revoke).not.toHaveBeenCalled()
    await waitFor(() => expect(meApi.credentials).toHaveBeenCalledTimes(2))
  })

  it("explains who sees credentials when there are none", async () => {
    jest.mocked(meApi.credentials).mockResolvedValue({ credentials: [] })
    renderWithIntl(<AccessPage />)

    expect(await screen.findByText("Nenhuma credencial para gerenciar")).toBeInTheDocument()
  })
})
