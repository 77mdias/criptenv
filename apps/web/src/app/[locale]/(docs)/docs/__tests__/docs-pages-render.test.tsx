/**
 * Every docs page must render. Regressions this guards against: DocCard given a
 * string icon (React tried to create `<🔒>`), StatusTable given the wrong props
 * (`codes.map` on undefined) and ResponseBlock given `code` instead of children.
 */
import fs from "fs"
import path from "path"
import type { ComponentType } from "react"

import { renderWithIntl } from "@/test/render-with-intl"
import docsPtBR from "../../../../../../messages/pt-BR/docs.json"

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  usePathname: () => "/docs",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

const docsRoot = path.resolve(__dirname, "..")

function findPages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : findPages(full)
    return entry.name === "page.tsx" ? [full] : []
  })
}

// Async server components (e.g. the /docs index) can't be rendered by RTL; tsc covers them.
const pages = findPages(docsRoot)
  .filter((file) => /^\s*['"]use client['"]/.test(fs.readFileSync(file, "utf8")))
  .map((file) => path.relative(docsRoot, file))

describe("docs pages", () => {
  it("finds the docs pages", () => {
    expect(pages.length).toBeGreaterThan(20)
  })

  it.each(pages)("%s renders without crashing", (page) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Page: ComponentType = require(path.join(docsRoot, page)).default
    const errors = jest.spyOn(console, "error").mockImplementation(() => {})

    const { container } = renderWithIntl(<Page />, { messages: { docs: docsPtBR } })

    // React 19 reports render crashes through console.error instead of throwing
    const reported = errors.mock.calls.map((args) => String(args[0]))
    errors.mockRestore()
    expect(reported).toEqual([])
    expect(container.querySelector("h1")).not.toBeNull()
  })
})
