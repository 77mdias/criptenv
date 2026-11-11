import { fireEvent, screen, waitFor } from "@testing-library/react"

import { CITokensPanel } from "@/components/shared/ci-tokens-panel"
import { ciTokensApi, environmentsApi } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

jest.mock("@/lib/api", () => ({
  ciTokensApi: { list: jest.fn(), create: jest.fn(), revoke: jest.fn() },
  environmentsApi: { list: jest.fn() },
  peekCached: jest.fn(() => undefined),
}))

const mockedTokens = jest.mocked(ciTokensApi)
const mockedEnvs = jest.mocked(environmentsApi)

beforeEach(() => {
  jest.clearAllMocks()
  mockedTokens.list.mockResolvedValue({ tokens: [], total: 0 } as never)
  mockedTokens.create.mockResolvedValue({ id: "t1", name: "deploy", token: "ci_x", scopes: ["read:secrets"] } as never)
  mockedEnvs.list.mockResolvedValue({
    environments: [
      { id: "e1", name: "production" },
      { id: "e2", name: "db-admin", restricted: true },
    ],
  } as never)
})

async function openModal() {
  renderWithIntl(<CITokensPanel projectId="p1" />)
  fireEvent.click(await screen.findByRole("button", { name: /novo token/i }))
  const select = (await screen.findByLabelText(/restrição de ambiente/i)) as HTMLSelectElement
  await waitFor(() => expect(select.options).toHaveLength(3))
  return select
}

describe("CITokensPanel environment", () => {
  it("offers the project's environments, restricted ones marked, instead of free text", async () => {
    const select = await openModal()

    expect(select.tagName).toBe("SELECT")
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Todos os ambientes",
      "production",
      "db-admin (restrito)",
    ])
    expect(mockedEnvs.list).toHaveBeenCalledWith("p1")
  })

  it("creates a token for the restricted environment", async () => {
    const select = await openModal()
    fireEvent.change(select, { target: { value: "db-admin" } })
    fireEvent.change(screen.getByPlaceholderText(/github actions deploy/i), { target: { value: "db" } })
    fireEvent.click(screen.getByRole("button", { name: /criar token/i }))

    await waitFor(() => expect(mockedTokens.create).toHaveBeenCalledTimes(1))
    expect(mockedTokens.create.mock.calls[0][1].environment_scope).toBe("db-admin")
  })

  it("sends no environment for 'all' and says the restricted ones stay out", async () => {
    await openModal()
    expect(screen.getByText(/não alcança os ambientes restritos/i)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/github actions deploy/i), { target: { value: "all" } })
    fireEvent.click(screen.getByRole("button", { name: /criar token/i }))

    await waitFor(() => expect(mockedTokens.create).toHaveBeenCalledTimes(1))
    expect(mockedTokens.create.mock.calls[0][1].environment_scope).toBeUndefined()
  })
})
