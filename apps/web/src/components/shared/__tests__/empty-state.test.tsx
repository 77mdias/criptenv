import { fireEvent, screen } from "@testing-library/react"

import { renderWithIntl } from "@/test/render-with-intl"

import { EmptyState } from "../empty-state"

describe("EmptyState", () => {
  it("shows the CLI command and copies it", async () => {
    renderWithIntl(<EmptyState title="Nenhum projeto" command="criptenv projects create meu-app" />)

    expect(screen.getByText("criptenv projects create meu-app")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Copiar comando" }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("criptenv projects create meu-app")
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument()
  })

  it("renders no command block when none is given", () => {
    renderWithIntl(<EmptyState title="Nada aqui" />)
    expect(screen.queryByRole("button", { name: "Copiar comando" })).not.toBeInTheDocument()
  })
})
