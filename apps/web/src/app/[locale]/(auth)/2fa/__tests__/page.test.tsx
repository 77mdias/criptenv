import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, useSearchParams } from "next/navigation"
import { authApi, ApiError } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import TwoFactorPage from "../page"

jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  authApi: {
    verify2FAChallenge: jest.fn(),
  },
}))

const mockedUseRouter = jest.mocked(useRouter)
const mockedUseSearchParams = jest.mocked(useSearchParams)

describe("TwoFactorPage", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth()
    mockedUseRouter.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>)
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("next=/projects") as unknown as ReturnType<typeof useSearchParams>)
  })

  it("verifies the challenge, remembers the device, and redirects to next", async () => {
    const push = jest.fn()
    mockedUseRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
    const mockedVerify = authApi.verify2FAChallenge as jest.Mock
    mockedVerify.mockResolvedValue({
      user: {
        id: "usr_1",
        email: "user@example.com",
        name: "User",
        kdf_salt: "salt",
        avatar_url: null,
      },
      session: { id: "ses_1" },
    })

    render(<TwoFactorPage />)
    await userEvent.type(screen.getByLabelText("Código 2FA"), "123456")
    await userEvent.click(screen.getByLabelText("Lembrar este dispositivo por 30 dias"))
    await userEvent.click(screen.getByRole("button", { name: "Verificar e continuar" }))

    await waitFor(() =>
      expect(mockedVerify).toHaveBeenCalledWith({
        code: "123456",
        remember_device: true,
      }),
    )
    expect(push).toHaveBeenCalledWith("/projects")
    expect(useAuthStore.getState().user?.id).toBe("usr_1")
  })

  it("shows an error when the challenge is rejected", async () => {
    const mockedVerify = authApi.verify2FAChallenge as jest.Mock
    mockedVerify.mockRejectedValue(new ApiError("Invalid verification code", 401, {}))

    render(<TwoFactorPage />)
    await userEvent.type(screen.getByLabelText("Código 2FA"), "000000")
    await userEvent.click(screen.getByRole("button", { name: "Verificar e continuar" }))

    expect(await screen.findByText(/Código inválido ou desafio expirado/)).toBeInTheDocument()
  })
})
