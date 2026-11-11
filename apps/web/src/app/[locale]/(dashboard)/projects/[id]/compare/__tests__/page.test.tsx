import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import dashboardMessages from "../../../../../../../../messages/pt-BR/dashboard.json"

import { projectsApi, vaultApi } from "@/lib/api"
import { useCryptoStore } from "@/stores/crypto"
import { renderWithIntl } from "@/test/render-with-intl"
import { decryptVault } from "../../secrets/vault-crypto"

import ComparePage from "../page"

let mockProjectId = "p1"
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: mockProjectId }),
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
  mockProjectId = "p1"
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

  it("starts over with the new project's environments when the project changes", async () => {
    const { rerender } = renderWithIntl(<ComparePage />)
    await screen.findByRole("heading", { name: /Só em production/ })

    jest.mocked(projectsApi.secretMatrix).mockResolvedValue({
      environments: [
        { id: "qa", name: "qa", is_default: true },
        { id: "uat", name: "uat", is_default: false },
      ],
      keys: [{ key_id: "ONLY_QA", cells: { qa: cell, uat: null } }],
    })
    mockProjectId = "p2"
    rerender(
      <NextIntlClientProvider locale="pt-BR" messages={{ dashboard: dashboardMessages }}>
        <ComparePage />
      </NextIntlClientProvider>,
    )

    const onlyQa = await screen.findByRole("heading", { name: /Só em qa/ })
    expect(onlyQa.parentElement).toHaveTextContent("ONLY_QA")
    expect(screen.getByLabelText("Ambiente B")).toHaveValue("uat")
  })

  it("drops a value comparison that finishes after the environments changed", async () => {
    const releases: (() => void)[] = []
    jest.mocked(vaultApi.pull).mockImplementation(
      (_p, env) => new Promise((resolve) => releases.push(() => resolve({ blobs: [{ env }], version: 1 } as never))),
    )
    useCryptoStore.getState().unlockProject("p1", {} as CryptoKey, "proof")
    renderWithIntl(<ComparePage />)

    fireEvent.click(await screen.findByRole("button", { name: "Comparar valores" }))
    await waitFor(() => expect(releases).toHaveLength(2))
    fireEvent.change(screen.getByLabelText("Ambiente A"), { target: { value: "prod" } })
    fireEvent.change(screen.getByLabelText("Ambiente B"), { target: { value: "dev" } })
    await act(async () => {
      releases.forEach((release) => release())
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(decryptVault).toHaveBeenCalled() // the old request did finish...
    expect(screen.queryByText("Diferente")).not.toBeInTheDocument() // ...and was ignored
    expect(screen.getByRole("button", { name: "Comparar valores" })).toBeInTheDocument()
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
