import { render, screen, waitFor } from "@testing-library/react"
import SettingsPage from "../page"
import { peekCached, projectsApi } from "@/lib/api"

const mockProject = {
  id: "project-1",
  owner_id: "user-1",
  name: "Project One",
  description: "Project description",
  current_user_role: "owner" as "owner" | "admin" | "developer" | "viewer",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

const mockPush = jest.fn()

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ push: mockPush }),
}))

jest.mock("@/lib/api", () => ({
  peekCached: jest.fn(() => ({
    id: "project-1",
    owner_id: "user-1",
    name: "Project One",
    description: "Project description",
    current_user_role: "owner",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  })),
  projectsApi: {
    get: jest.fn(() => Promise.resolve({
      id: "project-1",
      owner_id: "user-1",
      name: "Project One",
      description: "Project description",
      current_user_role: "owner",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    })),
    update: jest.fn(),
    delete: jest.fn(),
    rekeyVault: jest.fn(),
  },
  environmentsApi: { list: jest.fn() },
  vaultApi: { pull: jest.fn() },
}))

const mockPeekCached = peekCached as jest.MockedFunction<typeof peekCached>
const mockProjectsGet = projectsApi.get as jest.MockedFunction<typeof projectsApi.get>

jest.mock("@/lib/crypto", () => ({
  buildProjectVaultConfig: jest.fn(),
  checksum: jest.fn(),
  decrypt: jest.fn(),
  deriveSessionKeyFromBase64Salt: jest.fn(),
  deriveProjectEnvironmentKey: jest.fn(),
  encrypt: jest.fn(),
  unlockProjectVault: jest.fn(),
}))

jest.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { user: null }) => unknown) => selector({ user: null }),
}))

jest.mock("@/components/shared/ci-tokens-panel", () => ({
  CITokensPanel: () => <div>CI Tokens panel</div>,
}))

jest.mock("@/components/shared/api-keys-panel", () => ({
  ApiKeysPanel: () => <div>API Keys panel</div>,
}))

jest.mock("@/components/shared/project-alert-settings", () => ({
  ProjectAlertSettings: () => <div>Project alert settings controls</div>,
}))

jest.mock("@/components/shared/permission-dialog", () => ({
  PermissionDialog: () => <div>Permission dialog</div>,
}))

describe("SettingsPage project role gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPeekCached.mockReturnValue(mockProject)
    mockProjectsGet.mockResolvedValue(mockProject)
  })

  it.each(["owner", "admin"] as const)("renders alert settings for %s projects", async (role) => {
    const project = { ...mockProject, current_user_role: role }
    mockPeekCached.mockReturnValue(project)
    mockProjectsGet.mockResolvedValue(project)

    render(<SettingsPage />)

    expect(await screen.findByText("Project alert settings controls")).toBeInTheDocument()
    expect(screen.queryByText("Configurações restritas")).not.toBeInTheDocument()
  })

  it.each(["developer", "viewer"] as const)("denies alert settings controls for %s projects", async (role) => {
    const project = { ...mockProject, current_user_role: role }
    mockPeekCached.mockReturnValue(project)
    mockProjectsGet.mockResolvedValue(project)

    render(<SettingsPage />)

    await waitFor(() => expect(screen.getByText("Configurações restritas")).toBeInTheDocument())
    expect(screen.queryByText("Project alert settings controls")).not.toBeInTheDocument()
  })
})
