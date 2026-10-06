import { fireEvent, screen } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"

import { ExportModal } from "@/components/shared/export-modal"
import { type DecryptedSecret } from "@/components/shared/secret-row"

const secrets: DecryptedSecret[] = [
  { key: "API_KEY", value: "super-secret-value", createdAt: "" },
  { key: "DB_URL", value: "postgres://user:pass@db", createdAt: "" },
] as unknown as DecryptedSecret[]

describe("ExportModal", () => {
  it("never renders secret values on screen (no plaintext preview)", () => {
    renderWithIntl(<ExportModal open secrets={secrets} onOpenChange={() => {}} />)

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(document.body.textContent).not.toContain("super-secret-value")
    expect(document.body.textContent).not.toContain("postgres://user:pass@db")
  })

  it("materializes the plaintext only at download time", () => {
    const blobs: string[] = []
    const createObjectURL = jest.fn((blob: Blob) => {
      blobs.push((blob as unknown as { text?: () => Promise<string> }) as never)
      return "blob:mock"
    })
    const revokeObjectURL = jest.fn()
    window.URL.createObjectURL = createObjectURL as typeof URL.createObjectURL
    window.URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL

    const click = jest.fn()
    jest.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "a") return { click, href: "", download: "" } as unknown as HTMLAnchorElement
      return document.createElementNS("http://www.w3.org/1999/xhtml", tag) as never
    }) as typeof document.createElement)

    renderWithIntl(<ExportModal open secrets={secrets} onOpenChange={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /baixar/i }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock")
  })

  it("disables download when there are no secrets", () => {
    renderWithIntl(<ExportModal open secrets={[]} onOpenChange={() => {}} />)
    expect(screen.getByRole("button", { name: /baixar/i })).toBeDisabled()
  })
})
