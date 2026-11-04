import { fireEvent, screen, waitFor } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"

import { SyncModal } from "@/components/shared/sync-modal"
import { integrationsApi } from "@/lib/api"

jest.mock("@/lib/api", () => ({
  integrationsApi: { list: jest.fn(), sync: jest.fn() },
}))

const mocked = integrationsApi as jest.Mocked<typeof integrationsApi>

const integration = (id: string, provider: string, name: string) => ({
  id,
  provider,
  name,
  project_id: "p1",
  status: "active",
  last_sync_at: null,
  last_error: null,
  created_at: "2026-11-03T00:00:00Z",
})

const SECRETS = [
  { key: "API_KEY", value: "sk_1" },
  { key: "DATABASE_URL", value: "postgres://x" },
]

function renderModal(props: Partial<React.ComponentProps<typeof SyncModal>> = {}) {
  const onImport = jest.fn().mockResolvedValue(true)
  renderWithIntl(
    <SyncModal
      open
      onOpenChange={jest.fn()}
      projectId="p1"
      environmentName="preview"
      secrets={SECRETS}
      onImport={onImport}
      {...props}
    />,
  )
  return { onImport }
}

beforeEach(() => {
  jest.clearAllMocks()
  mocked.list.mockResolvedValue({
    integrations: [integration("v1", "vercel", "Vercel"), integration("c1", "cloudflare", "Worker")],
    total: 2,
    available_providers: ["vercel", "render", "cloudflare"],
  } as never)
})

describe("SyncModal", () => {
  it("pushes the decrypted environment to the Vercel target", async () => {
    mocked.sync.mockResolvedValue({ success: true, message: null, synced_count: 2, secrets: null })
    renderModal()

    await screen.findByLabelText(/integração/i)
    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }))

    await waitFor(() => expect(mocked.sync).toHaveBeenCalledTimes(1))
    expect(mocked.sync).toHaveBeenCalledWith("p1", "v1", {
      direction: "push",
      environment: "preview",
      secrets: SECRETS,
    })
    expect(await screen.findByRole("status")).toHaveTextContent("2 secrets enviados.")
  })

  it("shows the provider's message when the sync fails", async () => {
    mocked.sync.mockResolvedValue({
      success: false,
      message: "Vercel API returned 403: Not authorized",
      synced_count: null,
      secrets: null,
    })
    renderModal()

    await screen.findByLabelText(/integração/i)
    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Vercel API returned 403: Not authorized")
  })

  it("pull imports only new keys unless overwrite is checked", async () => {
    mocked.sync.mockResolvedValue({
      success: true,
      message: null,
      synced_count: 2,
      secrets: [
        { key: "API_KEY", value: "from-vercel" },
        { key: "NEW_KEY", value: "n" },
      ],
    })
    const { onImport } = renderModal()

    fireEvent.click(await screen.findByRole("button", { name: /importar para o criptenv/i }))
    fireEvent.click(screen.getByRole("button", { name: /^sincronizar$/i }))

    await waitFor(() => expect(onImport).toHaveBeenCalledWith([{ key: "NEW_KEY", value: "n" }]))
    expect(mocked.sync).toHaveBeenCalledWith("p1", "v1", { direction: "pull", environment: "preview" })
    expect(await screen.findByRole("status")).toHaveTextContent("1 importados, 1 ignorados")
  })

  it("does not offer pull for push-only providers", async () => {
    renderModal({ initialIntegrationId: "c1" })

    const pull = await screen.findByRole("button", { name: /importar para o criptenv/i })
    expect(pull).toBeDisabled()
    expect(screen.queryByLabelText(/ambiente na vercel/i)).not.toBeInTheDocument()
  })
})
