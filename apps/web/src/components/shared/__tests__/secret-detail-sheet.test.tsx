import { useState } from "react"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SecretDetailSheet } from "../secret-detail-sheet"
import { rotationApi } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

jest.mock("@/lib/api", () => ({
  rotationApi: { getRotationHistory: jest.fn() },
}))

const api = rotationApi as jest.Mocked<typeof rotationApi>

const environment = { id: "env-1", name: "production", display_name: "Production" } as never

const baseProps = {
  projectId: "project-1",
  environment,
  secretKey: "API_KEY",
  canManageSecrets: true,
  historyVersion: 1,
  copied: false,
  onCopy: jest.fn(),
  onRotate: jest.fn(),
  onSetExpiration: jest.fn(),
  onClose: jest.fn(),
}

describe("SecretDetailSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    api.getRotationHistory.mockResolvedValue({
      items: [
        {
          id: "r1",
          secret_key: "API_KEY",
          previous_version: 2,
          new_version: 3,
          rotated_by: "user-1",
          rotated_at: new Date().toISOString(),
          reason: "Manual rotation via web dashboard",
        },
      ],
      total: 1,
    })
  })

  it("shows the rotation history while the vault is locked, without value actions", async () => {
    renderWithIntl(<SecretDetailSheet {...baseProps} />)

    expect(screen.getByRole("dialog", { name: "API_KEY" })).toBeInTheDocument()
    expect(await screen.findByText("v2 → v3")).toBeInTheDocument()
    expect(screen.getByText("Manual rotation via web dashboard")).toBeInTheDocument()
    expect(api.getRotationHistory).toHaveBeenCalledWith("project-1", "env-1", "API_KEY")
    expect(screen.getByText(/Destrave o vault/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copiar valor" })).not.toBeInTheDocument()
  })

  it("copies and rotates through the page flows when the vault is unlocked", async () => {
    const secret = { key: "API_KEY", value: "s3cr3t" }
    renderWithIntl(<SecretDetailSheet {...baseProps} secret={secret} />)

    await userEvent.click(screen.getByRole("button", { name: "Copiar valor" }))
    expect(baseProps.onCopy).toHaveBeenCalledWith(secret)
    await userEvent.click(screen.getByRole("button", { name: "Rotacionar secret" }))
    expect(baseProps.onRotate).toHaveBeenCalledWith(secret)
  })

  it("opens the expiration flow even while the vault is locked", async () => {
    const expiration = {
      secret_key: "API_KEY",
      expires_at: "2026-11-01T00:00:00Z",
      days_until_expiration: 3,
      is_expired: false,
    } as never
    renderWithIntl(<SecretDetailSheet {...baseProps} expiration={expiration} />)

    await userEvent.click(screen.getByRole("button", { name: "Configurar expiração" }))
    expect(baseProps.onSetExpiration).toHaveBeenCalledWith(
      expect.objectContaining({ key: "API_KEY", expiresAt: "2026-11-01T00:00:00Z" }),
    )
  })

  it("returns focus to the trigger when closed", async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>API_KEY row</button>
          <SecretDetailSheet {...baseProps} secretKey={open ? "API_KEY" : null} onClose={() => setOpen(false)} />
        </>
      )
    }
    renderWithIntl(<Harness />)
    const trigger = screen.getByRole("button", { name: "API_KEY row" })

    await userEvent.click(trigger)
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
    await userEvent.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
