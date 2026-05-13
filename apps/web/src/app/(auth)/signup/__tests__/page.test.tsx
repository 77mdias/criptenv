import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import SignupPage from "../page"

jest.mock("@/hooks/use-auth")

const mockedUseAuth = jest.mocked(useAuth)
const mockedUseRouter = jest.mocked(useRouter)

describe("SignupPage", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset()
    mockedUseRouter.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>)
  })

  it("validates required form fields", async () => {
    mockedUseAuth.mockReturnValue({ signup: jest.fn() } as unknown as ReturnType<typeof useAuth>)

    render(<SignupPage />)
    await userEvent.click(screen.getByRole("button", { name: "Criar Conta" }))

    expect(await screen.findByText("Nome deve ter pelo menos 2 caracteres")).toBeInTheDocument()
    expect(screen.getByText("Email inválido")).toBeInTheDocument()
    expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument()
  })

  it("signs up and redirects to verification sent page", async () => {
    const signup = jest.fn().mockResolvedValue(null)
    const push = jest.fn()
    mockedUseAuth.mockReturnValue({ signup } as unknown as ReturnType<typeof useAuth>)
    mockedUseRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)

    render(<SignupPage />)
    await userEvent.type(screen.getByLabelText("Nome"), "Dev User")
    await userEvent.type(screen.getByLabelText("Email"), "dev@example.com")
    await userEvent.type(screen.getByLabelText("Senha"), "Passw0rd!")
    await userEvent.type(screen.getByLabelText("Confirmar Senha"), "Passw0rd!")
    await userEvent.click(screen.getByRole("button", { name: "Criar Conta" }))

    await waitFor(() => expect(signup).toHaveBeenCalledWith("dev@example.com", "Passw0rd!", "Dev User"))
    expect(push).toHaveBeenCalledWith("/verify-email/sent")
  })

  it("shows signup errors from the auth hook", async () => {
    mockedUseAuth.mockReturnValue({
      signup: jest.fn().mockRejectedValue(new Error("Email já cadastrado")),
    } as unknown as ReturnType<typeof useAuth>)

    render(<SignupPage />)
    await userEvent.type(screen.getByLabelText("Nome"), "Dev User")
    await userEvent.type(screen.getByLabelText("Email"), "dev@example.com")
    await userEvent.type(screen.getByLabelText("Senha"), "Passw0rd!")
    await userEvent.type(screen.getByLabelText("Confirmar Senha"), "Passw0rd!")
    await userEvent.click(screen.getByRole("button", { name: "Criar Conta" }))

    expect(await screen.findByText("Email já cadastrado")).toBeInTheDocument()
  })
})
