import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ConfirmActionDialog } from "../confirm-action-dialog"
import { PermissionDialog } from "../permission-dialog"

describe("permission and confirmation dialogs", () => {
  it("shows permission feedback and closes on action", async () => {
    const onOpenChange = jest.fn()
    render(<PermissionDialog open onOpenChange={onOpenChange} />)

    expect(screen.getByRole("dialog", { name: "Permissão necessária" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Entendi" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("confirms destructive actions", async () => {
    const onConfirm = jest.fn()
    render(
      <ConfirmActionDialog
        open
        title="Remover secret"
        description="Confirma a remoção"
        confirmLabel="Remover"
        destructive
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Remover" }))

    expect(onConfirm).toHaveBeenCalled()
  })
})
