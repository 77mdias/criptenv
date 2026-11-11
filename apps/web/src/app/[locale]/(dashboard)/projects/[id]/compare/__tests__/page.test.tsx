import { fireEvent, screen, waitFor, within } from "@testing-library/react"

import { projectsApi, vaultApi } from "@/lib/api"
import { useCryptoStore } from "@/stores/crypto"
import { renderWithIntl } from "@/test/render-with-intl"
import { decryptVault } from "../../secrets/vault-crypto"

import ComparePage from "../page"

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
}))

jest.mock("@/lib/api", () => ({
  peekCached: jest.fn(() => null),
  projectsApi: { secretMatrix: jest.fn(), get: jest.fn() },
  vaultApi: { pull: jest.fn() },
}))

jest.mock("@/lib/crypto", () => ({
  deriveProjectEnvironmentKey: jest.fn(async (_key: unknown, envId: string) => `key-${envId}`),
}))

jest.mock("../../secrets/vault-crypto", () => ({ decryptVault: jest.fn() }))

jest.mock("@/components/shared/vault-unlock-panel", () => ({
  VaultUnlockPanel: () => <div>unlock-panel</div>,
}))

const cell = { version: 1, updated_at: null }
const PLAINTEXT = { dev: "postgres://dev-secret", prod: "postgres://prod-secret" }

beforeEach(() => {
  jest.mocked(projectsApi.secretMatrix).mockResolvedValue({
    environments: [
      { id: "dev", name: "development", is_default: false },
      { id: "prod", name: "production", is_default: true },
    ],
    keys: [
      { key_id: "DATABASE_URL", cells: { dev: cell, prod: cell } },
      { key_id: "PORT", cells: { dev: cell, prod: cell } },
      { key_id: "STRIPE_KEY", cells: { dev: null, prod: cell } },
    ],
  })
  jest.mocked(projectsApi.get).mockResolvedValue({ id: "p1", vault_config: null } as never)
  jest.mocked(vaultApi.pull).mockImplementation(async (_p, env) => ({ blobs: [{ env }], version: 1 }) as never)
  jest.mocked(decryptVault).mockImplementation(async (blobs, key) => [
    { key: "DATABASE_URL", value: key === "key-dev" ? PLAINTEXT.dev : PLAINTEXT.prod },
    { key: "PORT", value: "8080" },
  ])
  useCryptoStore.getState().clearSession()
})

describe("CompareEnvironmentsPage", () => {
  it("lists keys missing on each side from the matrix", async () => {
    renderWithIntl(<ComparePage />)

    const onlyProd = await screen.findByRole("heading", { name: /Só em production/ })
    expect(within(onlyProd.parentElement as HTMLElement).getByText("STRIPE_KEY")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /Nos dois/ }).parentElement).toHaveTextContent("DATABASE_URL")
  })

  it("asks to unlock the vault when it is locked or unlocked for another project", async () => {
    useCryptoStore.getState().unlockProject("other-project", {} as CryptoKey, "proof")
    renderWithIntl(<ComparePage />)

    expect(await screen.findByText("unlock-panel")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Comparar valores" })).not.toBeInTheDocument()
    expect(vaultApi.pull).not.toHaveBeenCalled()
  })

  it("compares values in the browser and never sends a decrypted value anywhere", async () => {
    useCryptoStore.getState().unlockProject("p1", {} as CryptoKey, "proof")
    renderWithIntl(<ComparePage />)

    fireEvent.click(await screen.findByRole("button", { name: "Comparar valores" }))

    const row = (await screen.findByText("DATABASE_URL", { selector: "td" })).closest("tr") as HTMLElement
    expect(within(row).getByText("Diferente")).toBeInTheDocument()
    expect(within(row).getByText("po*****************et")).toBeInTheDocument()
    expect(within(screen.getByText("PORT", { selector: "td" }).closest("tr") as HTMLElement).getByText("Igual"))
      .toBeInTheDocument()
    await waitFor(() => expect(vaultApi.pull).toHaveBeenCalledTimes(2))

    const sent = JSON.stringify([
      jest.mocked(vaultApi.pull).mock.calls,
      jest.mocked(projectsApi.secretMatrix).mock.calls,
      jest.mocked(projectsApi.get).mock.calls,
    ])
    expect(sent).not.toContain(PLAINTEXT.dev)
    expect(sent).not.toContain(PLAINTEXT.prod)
    expect(document.body.textContent).not.toContain(PLAINTEXT.prod)
  })
})
