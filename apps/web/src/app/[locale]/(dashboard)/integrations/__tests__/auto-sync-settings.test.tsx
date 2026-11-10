import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { integrationsApi } from "@/lib/api"
import type { Environment, Integration } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

import { AutoSyncSettings } from "../_components/auto-sync-settings"

jest.mock("@/lib/api", () => ({
  integrationsApi: { update: jest.fn() },
}))

const mockedUpdate = jest.mocked(integrationsApi.update)
const MAX = ["auto_sync", "ci_sync", "sync_redeploy"]

function env(id: string, name: string): Environment {
  return { id, project_id: "p1", name, display_name: null, created_at: "", updated_at: "" }
}
const ENVS = [env("e-prod", "production"), env("e-stg", "staging")]

function integration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: "i1",
    project_id: "p1",
    provider: "vercel",
    name: "Site",
    status: "active",
    last_sync_at: null,
    last_error: null,
    created_at: "",
    auto_sync_targets: {},
    redeploy: false,
    ...overrides,
  }
}

function renderSettings(current: Integration, features: string[] = MAX, environments = ENVS) {
  const onSaved = jest.fn()
  renderWithIntl(
    <AutoSyncSettings
      projectId="p1"
      integration={current}
      environments={environments}
      features={features}
      onSaved={onSaved}
    />,
  )
  return { onSaved }
}

beforeEach(() => {
  mockedUpdate.mockReset().mockImplementation(async (_p, _i, body) => integration(body))
})

describe("AutoSyncSettings", () => {
  it("binds an environment to a target and saves at once", async () => {
    const { onSaved } = renderSettings(integration({ auto_sync_targets: { "e-prod": "production" } }))

    await userEvent.selectOptions(screen.getByLabelText("staging"), "preview")

    expect(mockedUpdate).toHaveBeenCalledWith("p1", "i1", {
      auto_sync_targets: { "e-prod": "production", "e-stg": "preview" },
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it("unbinds with 'Não enviar'", async () => {
    renderSettings(integration({ auto_sync_targets: { "e-prod": "production", "e-stg": "preview" } }))

    await userEvent.selectOptions(screen.getByLabelText("staging"), "Não enviar")

    expect(mockedUpdate).toHaveBeenCalledWith("p1", "i1", { auto_sync_targets: { "e-prod": "production" } })
  })

  it("turns the deploy option on and off", async () => {
    renderSettings(integration())

    await userEvent.click(screen.getByLabelText("Disparar novo deploy depois do envio"))

    expect(mockedUpdate).toHaveBeenCalledWith("p1", "i1", { redeploy: true })
  })

  it("locks the controls and names the Max plan without the features", () => {
    renderSettings(integration(), [])

    expect(screen.getByLabelText("production")).toBeDisabled()
    expect(screen.getByLabelText("staging")).toBeDisabled()
    expect(screen.getByLabelText("Disparar novo deploy depois do envio")).toBeDisabled()
    expect(screen.getByText("Disponível no plano Max.")).toBeInTheDocument()
  })

  it("does not mention the Max plan to who already has it", () => {
    renderSettings(integration())
    expect(screen.queryByText("Disponível no plano Max.")).not.toBeInTheDocument()
  })

  it("still lets a downgraded account turn off what is on, and nothing else", async () => {
    renderSettings(integration({ auto_sync_targets: { "e-prod": "production" }, redeploy: true }), [])

    const bound = screen.getByLabelText("production") as HTMLSelectElement
    expect(bound).toBeEnabled()
    expect(Array.from(bound.options).map((option) => option.value)).toEqual(["", "production"])
    expect(screen.getByLabelText("staging")).toBeDisabled()
    expect(screen.getByLabelText("Disparar novo deploy depois do envio")).toBeEnabled()

    await userEvent.selectOptions(bound, "Não enviar")
    expect(mockedUpdate).toHaveBeenCalledWith("p1", "i1", { auto_sync_targets: {} })
  })

  it("hides the deploy option for Cloudflare and explains why", () => {
    renderSettings(integration({ provider: "cloudflare" }))

    expect(screen.queryByLabelText("Disparar novo deploy depois do envio")).not.toBeInTheDocument()
    expect(screen.getByText("A Cloudflare já publica uma nova versão do Worker a cada envio.")).toBeInTheDocument()
  })

  it("offers only production for Render", () => {
    renderSettings(integration({ provider: "render" }))

    const select = screen.getByLabelText("staging") as HTMLSelectElement
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "production"])
  })

  it("shows an alert when saving fails and keeps the previous value", async () => {
    mockedUpdate.mockRejectedValue(new Error("Plan feature required: auto_sync"))
    const { onSaved } = renderSettings(integration())

    await userEvent.selectOptions(screen.getByLabelText("staging"), "preview")

    expect(await screen.findByRole("alert")).toHaveTextContent("Plan feature required: auto_sync")
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByLabelText("staging")).toHaveValue("")
  })

  it("drops a binding whose environment is gone on the next save", async () => {
    renderSettings(integration({ auto_sync_targets: { "e-gone": "production", "e-prod": "production" } }))

    await userEvent.selectOptions(screen.getByLabelText("staging"), "preview")

    expect(mockedUpdate).toHaveBeenCalledWith("p1", "i1", {
      auto_sync_targets: { "e-prod": "production", "e-stg": "preview" },
    })
  })
})
