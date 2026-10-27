import type { SecretMatrixResponse } from "@/lib/api/projects"
import { matrixRows } from "../matrix"
import { projectSnippets } from "../snippets"

const matrix: SecretMatrixResponse = {
  environments: [
    { id: "prod", name: "production", is_default: true },
    { id: "dev", name: "development", is_default: false },
  ],
  keys: [
    { key_id: "DATABASE_URL", cells: { prod: { version: 3, updated_at: null }, dev: { version: 1, updated_at: null } } },
    { key_id: "STRIPE_KEY", cells: { prod: { version: 2, updated_at: null }, dev: null } },
  ],
}

describe("matrixRows", () => {
  it("aligns cells with the environment columns and flags missing keys", () => {
    const rows = matrixRows(matrix, false)
    expect(rows.map((r) => [r.key, r.missingIn])).toEqual([["DATABASE_URL", 0], ["STRIPE_KEY", 1]])
    expect(rows[1].cells.map((c) => c?.version ?? null)).toEqual([2, null])
  })

  it("keeps only keys missing somewhere when filtering", () => {
    expect(matrixRows(matrix, true).map((r) => r.key)).toEqual(["STRIPE_KEY"])
  })

  it("treats a cell absent from the payload as missing", () => {
    const partial = { ...matrix, keys: [{ key_id: "NEW", cells: { prod: { version: 1, updated_at: null } } }] }
    expect(matrixRows(partial, false)[0].missingIn).toBe(1)
  })
})

describe("projectSnippets", () => {
  it("fills in the project id and environment everywhere", () => {
    const snippets = projectSnippets("prj-123", "staging")
    for (const code of Object.values(snippets)) expect(code).toContain("prj-123")
    expect(snippets.cli).toContain("criptenv run -e staging --")
    expect(snippets.githubAction).toContain("environment: staging")
    expect(snippets.githubAction).toContain("77mdias/criptenv/packages/github-action@github-action-v1")
  })
})
