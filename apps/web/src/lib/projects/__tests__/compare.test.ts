import { compareKeys, compareValues, maskValue } from "../compare"
import type { SecretMatrixResponse } from "@/lib/api/projects"

const cell = { version: 1, updated_at: null }

const matrix: SecretMatrixResponse = {
  environments: [
    { id: "dev", name: "development", is_default: false },
    { id: "prod", name: "production", is_default: true },
  ],
  keys: [
    { key_id: "API_URL", cells: { dev: cell, prod: cell } },
    { key_id: "DEBUG", cells: { dev: cell, prod: null } },
    { key_id: "STRIPE_KEY", cells: { dev: null, prod: cell } },
  ],
}

describe("compareKeys", () => {
  it("splits keys into only in A, only in B and in both", () => {
    expect(compareKeys(matrix, "dev", "prod")).toEqual({
      onlyA: ["DEBUG"],
      onlyB: ["STRIPE_KEY"],
      both: ["API_URL"],
    })
  })

  it("treats an environment missing from the matrix as empty", () => {
    expect(compareKeys(matrix, "dev", "gone")).toEqual({ onlyA: ["API_URL", "DEBUG"], onlyB: [], both: [] })
  })
})

describe("compareValues", () => {
  it("says, for each key in both, whether the values match", () => {
    const a = [{ key: "API_URL", value: "https://dev" }, { key: "PORT", value: "80" }, { key: "DEBUG", value: "1" }]
    const b = [{ key: "API_URL", value: "https://prod" }, { key: "PORT", value: "80" }]
    expect(compareValues(a, b)).toEqual([
      { key: "API_URL", same: false, a: "ht*******ev", b: "ht********od" },
      { key: "PORT", same: true, a: "**", b: "**" },
    ])
  })
})

describe("maskValue", () => {
  it("matches the CLI's diff --show-values mask", () => {
    expect(maskValue("")).toBe("<empty>")
    expect(maskValue("abcd")).toBe("****")
    expect(maskValue("abcdef")).toBe("ab**ef")
  })
})
