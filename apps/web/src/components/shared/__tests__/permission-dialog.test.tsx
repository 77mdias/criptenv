import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ConfirmActionDialog } from "../confirm-action-dialog"
import { PermissionDialog } from "../permission-dialog"
import { renderWithIntl } from "@/test/render-with-intl"
import accountPtBR from "../../../../messages/pt-BR/account.json"
import membersPtBR from "../../../../messages/pt-BR/members.json"

describe("permission and confirmation dialogs", () => {
  it("shows permission feedback and closes on action", async () => {
    const onOpenChange = jest.fn()
    renderWithIntl(<PermissionDialog open onOpenChange={onOpenChange} />, {
      messages: { members: membersPtBR },
    })

    expect(screen.getByRole("dialog", { name: "Permissão necessária" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Entendi" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("confirms destructive actions", async () => {
    const onConfirm = jest.fn()
    renderWithIntl(
      <ConfirmActionDialog
        open
        title="Remover secret"
        description="Confirma a remoção"
        confirmLabel="Remover"
        destructive
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
      />,
      { messages: { account: accountPtBR } }
    )

    await userEvent.click(screen.getByRole("button", { name: "Remover" }))

    expect(onConfirm).toHaveBeenCalled()
  })
})
