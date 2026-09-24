import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RolePicker } from "../role-picker"
import { renderWithIntl } from "@/test/render-with-intl"
import membersPtBR from "../../../../messages/pt-BR/members.json"

describe("RolePicker", () => {
  it("renders developer invite options without admin", () => {
    renderWithIntl(
      <RolePicker value="developer" options={["viewer", "developer"]} onChange={jest.fn()} />,
      { messages: { members: membersPtBR } }
    )

    expect(screen.getByRole("radio", { name: "Visualizador" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Desenvolvedor" })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "Administrador" })).not.toBeInTheDocument()
  })

  it("calls onChange when a role is selected", async () => {
    const onChange = jest.fn()
    renderWithIntl(
      <RolePicker value="viewer" options={["viewer", "developer"]} onChange={onChange} />,
      { messages: { members: membersPtBR } }
    )

    await userEvent.click(screen.getByRole("radio", { name: "Desenvolvedor" }))

    expect(onChange).toHaveBeenCalledWith("developer")
  })
})
