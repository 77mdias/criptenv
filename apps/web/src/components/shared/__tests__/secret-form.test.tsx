import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SecretForm } from "../secret-form"

describe("SecretForm", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <SecretForm open={false} title="Novo Secret" onOpenChange={jest.fn()} onSubmit={jest.fn()} />
    )

    expect(container.firstChild).toBeNull()
  })

  it("uppercases the key and submits valid secrets", async () => {
    const onSubmit = jest.fn()

    render(
      <SecretForm open title="Novo Secret" onOpenChange={jest.fn()} onSubmit={onSubmit} />
    )

    await userEvent.type(screen.getByLabelText("Chave"), "database_url")
    await userEvent.type(screen.getByLabelText("Valor"), "postgres://localhost")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        key: "DATABASE_URL",
        value: "postgres://localhost",
      })
    )
  })

  it("shows validation errors and calls cancel handlers", async () => {
    const onOpenChange = jest.fn()
    const onSubmit = jest.fn()

    render(
      <SecretForm open title="Novo Secret" onOpenChange={onOpenChange} onSubmit={onSubmit} />
    )

    await userEvent.type(screen.getByLabelText("Chave"), "AB")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Chave deve ter 3-64 caracteres")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
