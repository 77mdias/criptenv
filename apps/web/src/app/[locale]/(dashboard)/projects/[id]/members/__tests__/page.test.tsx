import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { membersApi, projectsApi } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Plan } from "@/lib/api/me"
import { renderWithIntl } from "@/test/render-with-intl"

import MembersPage from "../page"

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
}))

jest.mock("@/lib/api", () => ({
  peekCached: jest.fn(() => undefined),
  membersApi: {
    list: jest.fn(),
    listInvites: jest.fn(),
    inviteMember: jest.fn(),
    remove: jest.fn(),
    revokeInvite: jest.fn(),
    updateRole: jest.fn(),
  },
  projectsApi: { plan: jest.fn() },
}))

jest.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: "user-1" } }),
}))

const mockedPlan = jest.mocked(projectsApi.plan)
const mockedInvite = jest.mocked(membersApi.inviteMember)

function ownerPlan(members: number): Plan {
  return {
    id: "free",
    features: [],
    usage: { members_per_project: members },
    limits: {
      projects: 3,
      environments_per_project: 3,
      members_per_project: 3,
      integrations_per_project: 1,
      audit_retention_days: 7,
      personal_vault_items: 120,
      personal_vault_folders: 10,
    },
  }
}

const owner = {
  id: "member-1",
  project_id: "project-1",
  user_id: "user-1",
  role: "owner",
  name: "Ana",
  email: "ana@example.com",
  created_at: "2026-01-01T00:00:00Z",
}

async function openInviteForm() {
  await userEvent.click(await screen.findByRole("button", { name: "Convidar" }))
  await userEvent.type(screen.getByPlaceholderText("alice@example.com"), "bia@example.com")
}

describe("MembersPage plan limit", () => {
  beforeEach(() => {
    jest.mocked(membersApi.list).mockResolvedValue({ members: [owner], total: 1 } as never)
    jest.mocked(membersApi.listInvites).mockResolvedValue({ invites: [], total: 0 } as never)
    mockedInvite.mockReset()
    mockedPlan.mockReset()
    mockedPlan.mockRejectedValue(new Error("offline"))
  })

  it("shows the members usage the API reports, pending invites included", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(2))
    renderWithIntl(<MembersPage />)

    expect(await screen.findByText("2 de 3 membros")).toBeInTheDocument()
    expect(mockedPlan).toHaveBeenCalledWith("project-1")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("disables sending an invite at the limit", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(3))
    renderWithIntl(<MembersPage />)

    expect(await screen.findByRole("status")).toHaveTextContent("limite de 3 membros do plano do dono")
    await openInviteForm()
    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeDisabled()
  })

  it("shows the limit notice instead of the raw error on a 402", async () => {
    mockedInvite.mockRejectedValue(new ApiError("Plan limit reached: members_per_project (3)", 402, {}))
    renderWithIntl(<MembersPage />)
    await openInviteForm()
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite" }))

    expect(await screen.findByRole("status")).toHaveTextContent("O limite do plano foi atingido.")
    expect(screen.queryByText(/Plan limit reached/)).not.toBeInTheDocument()
  })

  it("reloads the plan after an invite is sent", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(1))
    mockedInvite.mockResolvedValue({} as never)
    renderWithIntl(<MembersPage />)
    await openInviteForm()
    mockedPlan.mockResolvedValue(ownerPlan(2))
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite" }))

    expect(await screen.findByText("2 de 3 membros")).toBeInTheDocument()
    await waitFor(() => expect(mockedPlan).toHaveBeenCalledTimes(2))
  })
})
