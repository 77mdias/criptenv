import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import LoginPage from "../page"

jest.mock("@/hooks/use-auth")

const mockedUseAuth = jest.mocked(useAuth)
const mockedUseRouter = jest.mocked(useRouter)

describe("LoginPage", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset()
    mockedUseRouter.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>)
  })

  it("validates required form fields", async () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn() } as unknown as ReturnType<typeof useAuth>)

    render(<LoginPage />)
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Email inválido")).toBeInTheDocument()
    expect(screen.getByText("Senha obrigatória")).toBeInTheDocument()
  })

  it("logs in and redirects to dashboard", async () => {
    const login = jest.fn().mockResolvedValue({ id: "usr_1" })
    const push = jest.fn()
    mockedUseAuth.mockReturnValue({ login } as unknown as ReturnType<typeof useAuth>)
    mockedUseRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com")
    await userEvent.type(screen.getByLabelText("Senha"), "secret")
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }))

    await waitFor(() => expect(login).toHaveBeenCalledWith("user@example.com", "secret"))
    expect(push).toHaveBeenCalledWith("/dashboard")
  })

  it("shows login errors from the auth hook", async () => {
    mockedUseAuth.mockReturnValue({
      login: jest.fn().mockRejectedValue(new Error("Email ou senha inválidos")),
    } as unknown as ReturnType<typeof useAuth>)

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com")
    await userEvent.type(screen.getByLabelText("Senha"), "wrong")
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Email ou senha inválidos")).toBeInTheDocument()
  })
})
