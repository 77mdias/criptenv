import { screen } from "@testing-library/react"
import type { AuditLog } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"
import { useAuthStore } from "@/stores/auth"
import { AuditEntry } from "../audit-entry"

function log(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: "log_1",
    project_id: "prj_1",
    user_id: "usr_2",
    action: "secret.rotated",
    resource_type: "secret",
    resource_id: null,
    meta: { secret_key: "API_KEY" },
    created_at: new Date().toISOString(),
    actor: { id: "usr_2", name: "Ana", email: "ana@example.com", avatar_url: null },
    auth_type: "session",
    ...overrides,
  }
}

describe("AuditEntry", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: "usr_1" } as never })
  })

  it("shows who did what instead of the raw user id", () => {
    renderWithIntl(<AuditEntry log={log({})} />)
    expect(screen.getByText("Ana rotacionou API_KEY")).toBeInTheDocument()
    expect(screen.queryByText(/usr_2/)).not.toBeInTheDocument()
  })

  it("labels the current user and CI pushes", () => {
    renderWithIntl(
      <>
        <AuditEntry log={log({ user_id: "usr_1", actor: { id: "usr_1", name: "Me", email: "me@x.com", avatar_url: null } })} />
        <AuditEntry
          log={log({
            id: "log_2",
            user_id: null,
            actor: null,
            auth_type: "ci_session",
            action: "vault.pushed",
            resource_type: "vault",
            meta: { blob_count: 2, auth_type: "ci_session" },
          })}
        />
      </>
    )
    expect(screen.getByText("Você rotacionou API_KEY")).toBeInTheDocument()
    expect(screen.getByText("CI atualizou o vault (2 secrets)")).toBeInTheDocument()
  })
})
