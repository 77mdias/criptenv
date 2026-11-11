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

  it("reads the environments again each time the form opens, so a new one shows up", async () => {
    renderWithIntl(<ApiKeysPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole("button", { name: /nova api key/i }))
    await waitFor(() => expect(mockedEnvs.list).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }))

    mockedEnvs.list.mockResolvedValue({
      environments: [
        { id: "e1", name: "development" },
        { id: "e3", name: "db-admin", restricted: true },
      ],
      total: 2,
    } as never)
    fireEvent.click(screen.getByRole("button", { name: /nova api key/i }))

    const select = screen.getByLabelText(/restrição de ambiente/i) as HTMLSelectElement
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toEqual([
        "Todos os ambientes",
        "development",
        "db-admin (restrito)",
      ]),
    )
  })

  it("explains that a key for every environment does not reach the restricted ones", async () => {
    renderWithIntl(<ApiKeysPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole("button", { name: /nova api key/i }))

    expect(await screen.findByText(/não alcança os ambientes restritos/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/restrição de ambiente/i), { target: { value: "development" } })
    expect(screen.queryByText(/não alcança os ambientes restritos/i)).not.toBeInTheDocument()
  })
})

describe("ApiKeysPanel scopes", () => {
  it("offers only the two read scopes, none of them 'coming soon'", async () => {
    renderWithIntl(<ApiKeysPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole("button", { name: /nova api key/i }))

    const boxes = screen.getAllByRole("checkbox")
    expect(boxes.map((box) => box.closest("label")?.textContent?.trim())).toEqual([
      "Ler segredos",
      "Ler auditoria",
    ])
    expect(screen.queryByText(/em breve/i)).not.toBeInTheDocument()
    expect(boxes.every((box) => !(box as HTMLInputElement).disabled)).toBe(true)
  })

  it("sends read:audit for a key of every environment", async () => {
    renderWithIntl(<ApiKeysPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole("button", { name: /nova api key/i }))
    fireEvent.click(screen.getByRole("checkbox", { name: /ler auditoria/i }))
    fireEvent.change(screen.getByPlaceholderText(/produção-ci/i), { target: { value: "audit" } })
    fireEvent.click(screen.getByRole("button", { name: /^criar$/i }))

    await waitFor(() => expect(mockedKeys.create).toHaveBeenCalledTimes(1))
    expect(mockedKeys.create.mock.calls[0][1].scopes).toEqual(["read:secrets", "read:audit"])
  })

  it("does not allow read:audit on a key limited to one environment", async () => {
    renderWithIntl(<ApiKeysPanel projectId="p1" />)
    fireEvent.click(await screen.findByRole("button", { name: /nova api key/i }))
    const audit = screen.getByRole("checkbox", { name: /ler auditoria/i }) as HTMLInputElement
    fireEvent.click(audit)

    const select = screen.getByLabelText(/restrição de ambiente/i)
    await waitFor(() => expect((select as HTMLSelectElement).options).toHaveLength(3))
    fireEvent.change(select, { target: { value: "production" } })

    expect(audit.checked).toBe(false)
    expect(audit.disabled).toBe(true)
    expect(screen.getByText(/auditoria é do projeto inteiro/i)).toBeInTheDocument()
  })
})
