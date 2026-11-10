import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { Integration } from "@/lib/api"
import type { AutoSyncResult } from "@/lib/auto-sync"
import { renderWithIntl } from "@/test/render-with-intl"

import { AutoSyncNotice } from "../_components/auto-sync-notice"

function result(overrides: Partial<AutoSyncResult> = {}): AutoSyncResult {
  const integration: Integration = {
    id: "i1",
    project_id: "p1",
    provider: "vercel",
    name: "Site",
    status: "active",
    last_sync_at: null,
    last_error: null,
    created_at: "2026-11-10T00:00:00Z",
    auto_sync_targets: { e1: "production" },
    redeploy: true,
  }
  return {
    integration, target: "production", ok: true, message: null, deployScheduled: false, deleteKeys: [], ...overrides,
  }
}

function renderNotice(results: AutoSyncResult[] | null) {
  const onResend = jest.fn()
  const onDismiss = jest.fn()
  const view = renderWithIntl(<AutoSyncNotice results={results} onResend={onResend} onDismiss={onDismiss} />)
  return { ...view, onResend, onDismiss }
}

describe("AutoSyncNotice", () => {
  it("renders nothing without results", () => {
    expect(renderNotice(null).container).toBeEmptyDOMElement()
    expect(renderNotice([]).container).toBeEmptyDOMElement()
  })

  it("says where it was sent and that a deploy is coming", () => {
    renderNotice([result({ deployScheduled: true })])
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Enviado para Site (production).")
    expect(status).toHaveTextContent("Novo deploy em cerca de 1 minuto.")
  })

  it("omits the deploy sentence when none was scheduled", () => {
    renderNotice([result()])
    expect(screen.getByRole("status")).not.toHaveTextContent("Novo deploy")
  })

  it("shows the provider error, says the vault was saved and offers to resend", async () => {
    const { onResend } = renderNotice([result({ ok: false, message: "Vercel API returned 403: forbidden" })])
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Não foi possível enviar para Site (production).")
    expect(alert).toHaveTextContent("Suas variáveis foram salvas no CriptEnv.")
    expect(alert).toHaveTextContent("Vercel API returned 403: forbidden")

    await userEvent.click(screen.getByRole("button", { name: "Reenviar" }))
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it("names the variables that were not removed at the host", () => {
    renderNotice([result({ ok: false, message: "boom", deleteKeys: ["OLD_KEY", "OTHER"] })])
    expect(screen.getByRole("alert")).toHaveTextContent("Ainda não removidas na hospedagem: OLD_KEY, OTHER.")
  })

  it("says nothing about removals when the failed send had none", () => {
    renderNotice([result({ ok: false, message: "boom" })])
    expect(screen.getByRole("alert")).not.toHaveTextContent("Ainda não removidas")
  })

  it("lists one line per connection, failures as alerts", () => {
    renderNotice([result(), result({ ok: false, message: null })])
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getAllByRole("alert")).toHaveLength(1)
  })

  it("can be dismissed", async () => {
    const { onDismiss } = renderNotice([result()])
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso" }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
