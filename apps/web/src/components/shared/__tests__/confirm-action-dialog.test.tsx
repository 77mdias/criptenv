import { fireEvent, screen, waitFor } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"
import { ApiError } from "@/lib/api/client"
import { useAuthStore, type AuthUser } from "@/stores/auth"
import { ConfirmActionDialog } from "../confirm-action-dialog"

const USER: AuthUser = { id: "u1", email: "ana@example.com", name: "Ana", kdf_salt: "s", avatar_url: null }
const CODE_LABEL = "Código de verificação"

function refusal(code: string, status = 403) {
  return new ApiError("refused", status, { detail: { code, message: "refused" } })
}

function renderDialog(onConfirm: (code?: string) => void | Promise<void>, secondFactor = true) {
  renderWithIntl(
    <ConfirmActionDialog
      open
      title="Remover segredo"
      description="Isso não pode ser desfeito."
      confirmLabel="Remover"
      destructive
      secondFactor={secondFactor}
      onConfirm={onConfirm}
      onOpenChange={() => {}}
    />,
  )
  return screen.getByRole("button", { name: "Remover" })
}

describe("ConfirmActionDialog second factor", () => {
  afterEach(() => useAuthStore.setState({ user: null }))

  it("an account without 2FA confirms with no code", () => {
    useAuthStore.setState({ user: USER })
    const onConfirm = jest.fn()
    fireEvent.click(renderDialog(onConfirm))
    expect(screen.queryByLabelText(CODE_LABEL)).not.toBeInTheDocument()
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it("an account with 2FA must type the code, which goes to onConfirm", () => {
    useAuthStore.setState({ user: { ...USER, two_factor_enabled: true } })
    const onConfirm = jest.fn()
    const confirm = renderDialog(onConfirm)

    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(CODE_LABEL), { target: { value: " 123456 " } })
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith("123456")
  })

  it("an action the API does not guard never asks for the code", () => {
    useAuthStore.setState({ user: { ...USER, two_factor_enabled: true } })
    const onConfirm = jest.fn()
    fireEvent.click(renderDialog(onConfirm, false))
    expect(screen.queryByLabelText(CODE_LABEL)).not.toBeInTheDocument()
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it.each([
    ["TWO_FACTOR_INVALID", 403, "Código inválido. Confira e tente de novo."],
    ["TWO_FACTOR_LOCKED", 429, "Muitas tentativas. Aguarde alguns minutos e tente de novo."],
  ])("shows a refused code (%s) and clears the field", async (code, status, message) => {
    useAuthStore.setState({ user: { ...USER, two_factor_enabled: true } })
    const confirm = renderDialog(jest.fn().mockRejectedValue(refusal(code, status)))

    fireEvent.change(screen.getByLabelText(CODE_LABEL), { target: { value: "123456" } })
    fireEvent.click(confirm)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText(CODE_LABEL)).toHaveValue("")
  })

  it("asks for the code when the API wants one this page did not expect", async () => {
    useAuthStore.setState({ user: USER })
    const onConfirm = jest.fn().mockRejectedValueOnce(refusal("TWO_FACTOR_REQUIRED")).mockResolvedValue(undefined)
    const confirm = renderDialog(onConfirm)

    fireEvent.click(confirm)
    const field = await screen.findByLabelText(CODE_LABEL)
    expect(screen.getByText("Digite o código do app autenticador para confirmar.")).toBeInTheDocument()

    fireEvent.change(field, { target: { value: "654321" } })
    fireEvent.keyDown(field, { key: "Enter" })
    await waitFor(() => expect(onConfirm).toHaveBeenLastCalledWith("654321"))
  })
})
