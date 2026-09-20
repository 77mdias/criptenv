import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProjectAlertSettings } from "../project-alert-settings"
import { alertSettingsApi } from "@/lib/api/alert-settings"

jest.mock("@/lib/api/alert-settings", () => ({
  alertSettingsApi: {
    get: jest.fn(),
    update: jest.fn(),
    testWebhook: jest.fn(),
  },
}))

const api = alertSettingsApi as jest.Mocked<typeof alertSettingsApi>

const configuredSettings = {
  enabled: true,
  default_notify_days_before: 7,
  channels: { in_app: true, email: false, webhook: false },
  webhook_configured: true,
  webhook_url_preview: "https://hooks.example.test/...abcd",
}

const unconfiguredSettings = {
  ...configuredSettings,
  webhook_configured: false,
  webhook_url_preview: null,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

describe("ProjectAlertSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    api.get.mockResolvedValue(configuredSettings)
    api.update.mockResolvedValue(configuredSettings)
    api.testWebhook.mockResolvedValue({ success: true })
  })

  it("loads safe webhook metadata without rendering the saved URL", async () => {
    render(<ProjectAlertSettings projectId="project-1" />)

    expect(await screen.findByText(/webhook configurado/i)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(configuredSettings.webhook_url_preview))).toBeInTheDocument()
    expect(screen.queryByDisplayValue("https://hooks.example.test/secret-token")).not.toBeInTheDocument()
  })

  it("updates channels and lead time with the write-only webhook URL", async () => {
    const user = userEvent.setup()
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText(/webhook configurado/i)
    await user.click(screen.getByRole("switch", { name: "Canal email" }))
    await user.click(screen.getByRole("switch", { name: "Canal webhook" }))
    await user.selectOptions(screen.getByLabelText(/prazo padrão/i), "14")
    await user.type(screen.getByLabelText(/url do webhook/i), "https://hooks.example.test/new-token")
    await user.click(screen.getByRole("button", { name: /salvar configurações/i }))

    await waitFor(() => {
      expect(api.update).toHaveBeenCalledWith("project-1", {
        enabled: true,
        default_notify_days_before: 14,
        channels: { in_app: true, email: true, webhook: true },
        webhook_url: "https://hooks.example.test/new-token",
      })
    })
  })

  it("tests and removes a configured webhook", async () => {
    const user = userEvent.setup()
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText(/webhook configurado/i)
    await user.click(screen.getByRole("button", { name: /testar webhook/i }))
    expect(await screen.findByText(/webhook testado com sucesso/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /remover configuração/i }))
    await waitFor(() => {
      expect(api.update).toHaveBeenCalledWith("project-1", expect.objectContaining({ webhook_url: null }))
    })
  })

  it("warns explicitly when all channels are disabled and sanitizes failures", async () => {
    const user = userEvent.setup()
    api.update.mockRejectedValue(new Error("https://private-host/secret-token"))
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText(/webhook configurado/i)
    await user.click(screen.getByRole("switch", { name: "Canal in-app" }))
    expect(screen.getByText(/todos os canais estão desativados/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /salvar configurações/i }))

    expect(await screen.findByText(/não foi possível salvar as configurações de alertas/i)).toBeInTheDocument()
    expect(screen.queryByText(/private-host|secret-token/i)).not.toBeInTheDocument()
  })

  it("shows a loading skeleton while settings are loading", () => {
    const request = deferred<typeof configuredSettings>()
    api.get.mockReturnValue(request.promise)

    render(<ProjectAlertSettings projectId="project-1" />)

    expect(screen.getByLabelText("Carregando configurações de alertas")).toBeInTheDocument()
  })

  it("shows a safe error when settings cannot be loaded", async () => {
    api.get.mockRejectedValue(new Error("private backend details"))

    render(<ProjectAlertSettings projectId="project-1" />)

    expect(await screen.findByText(/não foi possível carregar as configurações/i)).toBeInTheDocument()
    expect(screen.queryByText(/private backend details/i)).not.toBeInTheDocument()
  })

  it("blocks mutations after a load failure and retries the initial load", async () => {
    const user = userEvent.setup()
    api.get.mockRejectedValueOnce(new Error("private load details")).mockResolvedValueOnce(configuredSettings)
    render(<ProjectAlertSettings projectId="project-1" />)

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar as configurações/i)
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /salvar configurações/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /remover configuração/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /testar webhook/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /tentar novamente/i }))
    expect(await screen.findByText(/webhook configurado/i)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it("keeps the save action busy and reports a sanitized save error", async () => {
    const user = userEvent.setup()
    const update = deferred<typeof configuredSettings>()
    api.update.mockReturnValue(update.promise)
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText(/webhook configurado/i)
    const saveButton = screen.getByRole("button", { name: /salvar configurações/i })
    await user.click(saveButton)
    expect(saveButton).toHaveAttribute("aria-busy", "true")

    update.reject(new Error("secret save details"))
    expect(await screen.findByText(/não foi possível salvar as configurações de alertas/i)).toBeInTheDocument()
    expect(screen.queryByText(/secret save details/i)).not.toBeInTheDocument()
  })

  it("keeps remove busy and reports a sanitized remove error", async () => {
    const user = userEvent.setup()
    const update = deferred<typeof configuredSettings>()
    api.update.mockReturnValue(update.promise)
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText(/webhook configurado/i)
    const removeButton = screen.getByRole("button", { name: /remover configuração/i })
    await user.click(removeButton)
    expect(removeButton).toHaveAttribute("aria-busy", "true")

    update.reject(new Error("secret remove details"))
    expect(await screen.findByText(/não foi possível salvar as configurações de alertas/i)).toBeInTheDocument()
    expect(screen.queryByText(/secret remove details/i)).not.toBeInTheDocument()
  })

  it("does not offer webhook testing when no webhook is configured", async () => {
    api.get.mockResolvedValue(unconfiguredSettings)
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText("Alertas de expiração")
    expect(screen.queryByText(/configuração do webhook/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /testar webhook/i })).not.toBeInTheDocument()
  })

  it("uses responsive layout guard classes for narrow viewports", async () => {
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByTestId("project-alert-settings")
    expect(screen.getByTestId("project-alert-settings")).toHaveClass("p-4", "sm:p-6")
    expect(screen.getByText(new RegExp(configuredSettings.webhook_url_preview))).toHaveClass("break-all")
  })

  it("resets controls and blocks the previous project while a new project loads", async () => {
    const secondProject = deferred<typeof configuredSettings>()
    api.get.mockResolvedValueOnce(configuredSettings).mockReturnValueOnce(secondProject.promise)
    const { rerender } = render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText(/webhook configurado/i)
    rerender(<ProjectAlertSettings projectId="project-2" />)

    expect(await screen.findByLabelText("Carregando configurações de alertas")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /salvar configurações/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /remover configuração/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /testar webhook/i })).not.toBeInTheDocument()

    secondProject.resolve({ ...configuredSettings, webhook_configured: false, webhook_url_preview: null })
    expect(await screen.findByRole("button", { name: /salvar configurações/i })).toBeInTheDocument()
  })

  it("disables every mutation control while saving and applies the response state", async () => {
    const user = userEvent.setup()
    const update = deferred<typeof configuredSettings>()
    api.update.mockReturnValue(update.promise)
    render(<ProjectAlertSettings projectId="project-1" />)

    await screen.findByText(/webhook configurado/i)
    await user.click(screen.getByRole("button", { name: /salvar configurações/i }))

    expect(screen.getByRole("button", { name: /salvar configurações/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /testar webhook/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /remover configuração/i })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "Alertas do projeto" })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "Canal email" })).toBeDisabled()
    expect(screen.getByLabelText(/prazo padrão/i)).toBeDisabled()
    expect(screen.getByLabelText(/url do webhook/i)).toBeDisabled()

    const response = {
      ...configuredSettings,
      enabled: false,
      default_notify_days_before: 14,
      channels: { in_app: false, email: true, webhook: false },
      webhook_configured: false,
      webhook_url_preview: null,
    }
    update.resolve(response)

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "Alertas do projeto" })).toHaveAttribute("aria-checked", "false")
      expect(screen.getByRole("switch", { name: "Canal email" })).toHaveAttribute("aria-checked", "true")
      expect(screen.getByLabelText(/prazo padrão/i)).toHaveValue("14")
    })
  })
})
