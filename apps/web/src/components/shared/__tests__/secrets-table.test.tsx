import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SecretsTable } from "../secrets-table"
import type { DecryptedSecret } from "../secret-row"

const secrets: DecryptedSecret[] = [
  { key: "DATABASE_URL", value: "postgres://localhost" },
  { key: "API_KEY", value: "secret-key" },
]

const baseProps = {
  secrets,
  environmentName: "Production",
  onCopy: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onCreate: jest.fn(),
}

describe("SecretsTable", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders admin bulk selection toolbar and select-all control", async () => {
    const onSelectAllChange = jest.fn()
    const onBulkDelete = jest.fn()

    render(
      <SecretsTable
        {...baseProps}
        canManageSecrets
        selectedKeys={["DATABASE_URL"]}
        onSelectChange={jest.fn()}
        onSelectAllChange={onSelectAllChange}
        onClearSelection={jest.fn()}
        onBulkDelete={onBulkDelete}
      />
    )

    expect(screen.getByText("1 de 2 selecionadas")).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar todas as secrets deste ambiente" })
    )
    await userEvent.click(screen.getByRole("button", { name: /excluir selecionadas/i }))

    expect(onSelectAllChange).toHaveBeenCalledWith(true)
    expect(onBulkDelete).toHaveBeenCalledTimes(1)
  })

  it("hides bulk controls for non-admin project roles", () => {
    render(
      <SecretsTable
        {...baseProps}
        canManageSecrets={false}
        selectedKeys={["DATABASE_URL"]}
        onSelectChange={jest.fn()}
        onSelectAllChange={jest.fn()}
        onClearSelection={jest.fn()}
        onBulkDelete={jest.fn()}
      />
    )

    expect(
      screen.queryByRole("checkbox", { name: "Selecionar todas as secrets deste ambiente" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /excluir selecionadas/i })).not.toBeInTheDocument()
  })
})
