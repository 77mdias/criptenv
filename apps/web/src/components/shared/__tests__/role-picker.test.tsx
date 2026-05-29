import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RolePicker } from "../role-picker"

describe("RolePicker", () => {
  it("renders developer invite options without admin", () => {
    render(<RolePicker value="developer" options={["viewer", "developer"]} onChange={jest.fn()} />)

    expect(screen.getByRole("radio", { name: "viewer" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "developer" })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "admin" })).not.toBeInTheDocument()
  })

  it("calls onChange when a role is selected", async () => {
    const onChange = jest.fn()
    render(<RolePicker value="viewer" options={["viewer", "developer"]} onChange={onChange} />)

    await userEvent.click(screen.getByRole("radio", { name: "developer" }))

    expect(onChange).toHaveBeenCalledWith("developer")
  })
})
