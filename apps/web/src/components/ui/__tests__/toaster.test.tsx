import { act, render, screen } from "@testing-library/react"
import { Toaster } from "../toaster"
import { toast, useToastStore } from "@/stores/toast"

describe("Toaster", () => {
  afterEach(() => act(() => useToastStore.getState().dismiss()))

  it("shows the message passed to toast()", () => {
    render(<Toaster />)
    expect(screen.queryByText("API_KEY copiado")).not.toBeInTheDocument()

    act(() => toast("API_KEY copiado"))

    expect(screen.getAllByText("API_KEY copiado").length).toBeGreaterThan(0)
  })
})
