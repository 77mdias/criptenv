import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, useSearchParams } from "next/navigation"
import AcceptInvitePage from "../page"
import { request } from "@/lib/api/client"

jest.mock("@/lib/api/client", () => ({
  request: jest.fn(),
}))

const mockedRequest = jest.mocked(request)
const mockedUseRouter = jest.mocked(useRouter)
const mockedUseSearchParams = jest.mocked(useSearchParams)

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    mockedUseRouter.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>)
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("token=invite-token") as unknown as ReturnType<typeof useSearchParams>)
    mockedRequest.mockReset()
  })

  it("renders invite details in a compact auth-layout panel", async () => {
    mockedRequest.mockResolvedValueOnce({
      project_id: "prj_1",
      email: "dev@example.com",
      role: "developer",
    })

    const { container } = render(<AcceptInvitePage />)

    expect(await screen.findByRole("heading", { name: "Convite para projeto" })).toBeInTheDocument()
    expect(screen.getByText("dev@example.com")).toBeInTheDocument()
    expect(screen.getByText("developer")).toBeInTheDocument()
    expect(container.querySelector(".min-h-screen")).not.toBeInTheDocument()
  })

  it("accepts an invite and shows the compact success state", async () => {
    mockedRequest
      .mockResolvedValueOnce({
        project_id: "prj_1",
        email: "dev@example.com",
        role: "developer",
      })
      .mockResolvedValueOnce({ message: "Invite accepted successfully." })

    render(<AcceptInvitePage />)

    await userEvent.click(await screen.findByRole("button", { name: /Aceitar convite/ }))

    await waitFor(() => {
      expect(mockedRequest).toHaveBeenCalledWith("POST", "/api/auth/invites/accept?token=invite-token")
    })
    expect(screen.getByRole("heading", { name: "Convite aceito" })).toBeInTheDocument()
  })
})
