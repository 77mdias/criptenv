import { fireEvent, screen } from "@testing-library/react"

import { usePathname, useRouter } from "@/i18n/navigation"
import { peekCached } from "@/lib/api"
import { useUIStore } from "@/stores/ui"
import { renderWithIntl } from "@/test/render-with-intl"

import { CommandPalette } from "../command-palette"

jest.mock("@/lib/api", () => ({ peekCached: jest.fn() }))

const overview = {
  projects: [
    {
      id: "p1",
      name: "api",
      slug: "api",
      role: "owner",
      member_count: 1,
      manager_count: 1,
      last_activity_at: null,
      environments: [
        { id: "e-dev", name: "development", is_default: false, secret_count: 1, stale_secret_count: 0, version: 1, updated_at: null },
        { id: "e-prod", name: "production", is_default: true, secret_count: 1, stale_secret_count: 0, version: 1, updated_at: null },
      ],
    },
  ],
  attention: { expired: [], expiring: [], pending_invites: [], stale_credentials: [], failing_integrations: [] },
  totals: { projects: 1, secrets: 2, members: 1 },
}

const matrix = {
  environments: [{ id: "e-prod", name: "production", is_default: true }],
  keys: [{ key_id: "STRIPE_KEY", cells: { "e-prod": { version: 1, updated_at: null } } }],
}

function open(pathname = "/dashboard", cache: Record<string, unknown> = {}) {
  jest.mocked(usePathname).mockReturnValue(pathname)
  jest.mocked(peekCached).mockImplementation((path: string) => (cache[path] ?? null) as never)
  useUIStore.setState({ commandPaletteOpen: true })
  renderWithIntl(<CommandPalette />)
  return screen.getByRole("combobox")
}

describe("CommandPalette", () => {
  it("is an accessible dialog with a listbox driven by the search box", () => {
    const input = open()
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true")
    expect(screen.getByRole("listbox")).toBeInTheDocument()
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id)
  })

  it("moves the selection with the arrow keys and runs it with Enter", () => {
    const input = open()
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(useRouter().push).toHaveBeenCalledWith("/projects")
  })

  it("finds projects and environments from the cached overview", () => {
    const input = open("/dashboard", { "/api/v1/me/overview": overview })
    fireEvent.change(input, { target: { value: "production" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(useRouter().push).toHaveBeenCalledWith("/projects/p1/secrets?env=e-prod")
  })

  it("finds secrets by name in the open project", () => {
    const input = open("/projects/p1/secrets", {
      "/api/v1/me/overview": overview,
      "/api/v1/projects/p1/secrets/matrix": matrix,
    })
    fireEvent.change(input, { target: { value: "stripe" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(useRouter().push).toHaveBeenCalledWith("/projects/p1/secrets?key=STRIPE_KEY")
  })

  it("copies a CLI command for the open project and its default environment", () => {
    const input = open("/projects/p1", { "/api/v1/me/overview": overview })
    fireEvent.change(input, { target: { value: "rodar" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("criptenv run -p p1 -e production -- ")
  })

  it("still lists the screens when nothing is cached", () => {
    const input = open()
    fireEvent.change(input, { target: { value: "segurança" } })
    expect(screen.getByRole("option", { name: /Segurança/ })).toBeInTheDocument()
  })
})
