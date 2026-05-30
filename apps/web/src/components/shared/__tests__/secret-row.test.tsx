import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SecretRow, type DecryptedSecret } from "../secret-row"

const secret: DecryptedSecret = {
  key: "DATABASE_URL",
  value: "postgres://localhost",
  daysUntilExpiration: 3,
  expiresAt: "2026-06-01",
}

describe("SecretRow", () => {
  it("reveals and hides secret values", async () => {
    render(
      <SecretRow secret={secret} environmentName="Production" onCopy={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />
    )

    expect(screen.queryByText(secret.value)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Revelar secret" }))
    expect(screen.getByText(secret.value)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ocultar secret" }))
    expect(screen.queryByText(secret.value)).not.toBeInTheDocument()
  })

  it("fires copy, edit, and delete callbacks", async () => {
    const onCopy = jest.fn()
    const onEdit = jest.fn()
    const onDelete = jest.fn()

    render(
      <SecretRow secret={secret} environmentName="Production" onCopy={onCopy} onEdit={onEdit} onDelete={onDelete} copied />
    )

    expect(screen.getByText("copiado")).toBeInTheDocument()
    expect(screen.getByText("3 dias")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Copiar valor" }))
    await userEvent.click(screen.getByRole("button", { name: "Editar secret" }))
    await userEvent.click(screen.getByRole("button", { name: "Remover secret" }))

    expect(onCopy).toHaveBeenCalledWith(secret)
    expect(onEdit).toHaveBeenCalledWith(secret)
    expect(onDelete).toHaveBeenCalledWith(secret)
  })

  it("hides admin-only actions for non-admin project roles", () => {
    render(
      <SecretRow
        secret={secret}
        environmentName="Production"
        canManageSecrets={false}
        onCopy={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onRotate={jest.fn()}
        onSetExpiration={jest.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Copiar valor" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Editar secret" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Rotacionar secret" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Configurar expiração" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover secret" })).not.toBeInTheDocument()
  })
  it("renders selectable checkbox for admin bulk actions", async () => {
    const onSelectChange = jest.fn()

    render(
      <SecretRow
        secret={secret}
        environmentName="Production"
        canManageSecrets
        selectable
        selected={false}
        onSelectChange={onSelectChange}
        onCopy={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    )

    await userEvent.click(screen.getByRole("checkbox", { name: "Selecionar secret DATABASE_URL" }))

    expect(onSelectChange).toHaveBeenCalledWith(secret, true)
  })

  it("does not render selectable checkbox for non-admin roles", () => {
    render(
      <SecretRow
        secret={secret}
        environmentName="Production"
        canManageSecrets={false}
        selectable
        selected
        onSelectChange={jest.fn()}
        onCopy={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    )

    expect(screen.queryByRole("checkbox", { name: "Selecionar secret DATABASE_URL" })).not.toBeInTheDocument()
  })

})
