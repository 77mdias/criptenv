import { fireEvent, screen, waitFor } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"

import { ApiKeysPanel } from "@/components/shared/api-keys-panel"
import { apiKeysApi, environmentsApi } from "@/lib/api"

jest.mock("@/lib/api", () => ({
  apiKeysApi: { list: jest.fn(), create: jest.fn(), revoke: jest.fn() },
  environmentsApi: { list: jest.fn() },
}))

const mockedKeys = apiKeysApi as jest.Mocked<typeof apiKeysApi>
const mockedEnvs = environmentsApi as jest.Mocked<typeof environmentsApi>

beforeEach(() => {
  jest.clearAllMocks()
  mockedKeys.list.mockResolvedValue({ items: [], total: 0 } as never)
  mockedKeys.create.mockResolvedValue({ id: "k1", name: "ci", key: "cek_live_x", scopes: ["read:secrets"] } as never)
  mockedEnvs.list.mockResolvedValue({
    environments: [{ id: "e1", name: "development" }, { id: "e2", name: "production" }],
    total: 2,
  } as never)
})

async function openFormAndCreate(envValue: string) {
  renderWithIntl(<ApiKeysPanel projectId="p1" />)
  fireEvent.click(await screen.findByRole("button", { name: /nova api key/i }))
  const select = screen.getByLabelText(/restrição de ambiente/i) as HTMLSelectElement
  await waitFor(() => expect(select.options).toHaveLength(3))
  expect([...select.options].map((o) => o.textContent)).toEqual([
    "Todos os ambientes",
    "development",
    "production",
  ])
  fireEvent.change(select, { target: { value: envValue } })
  fireEvent.change(screen.getByPlaceholderText(/produção-ci/i), { target: { value: "ci" } })
  fireEvent.click(screen.getByRole("button", { name: /^criar$/i }))
  await waitFor(() => expect(mockedKeys.create).toHaveBeenCalledTimes(1))
  return mockedKeys.create.mock.calls[0][1]
}

describe("ApiKeysPanel environment scope", () => {
  it("sends the chosen environment name", async () => {
    expect((await openFormAndCreate("development")).environment_scope).toBe("development")
  })

  it("sends no scope for 'all environments'", async () => {
    expect((await openFormAndCreate("")).environment_scope).toBeUndefined()
  })
})
