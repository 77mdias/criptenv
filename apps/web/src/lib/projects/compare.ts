import type { SecretMatrixResponse } from "@/lib/api/projects"

export interface KeyComparison {
  onlyA: string[]
  onlyB: string[]
  both: string[]
}

/** Which keys exist in A, in B, or in both, from the matrix (names only, never values). */
export function compareKeys(matrix: SecretMatrixResponse, envA: string, envB: string): KeyComparison {
  const result: KeyComparison = { onlyA: [], onlyB: [], both: [] }
  for (const { key_id, cells } of matrix.keys) {
    const inA = Boolean(cells[envA])
    const inB = Boolean(cells[envB])
    if (inA && inB) result.both.push(key_id)
    else if (inA) result.onlyA.push(key_id)
    else if (inB) result.onlyB.push(key_id)
  }
  return result
}

export interface ValueComparison {
  key: string
  same: boolean
  /** masked previews, never the value */
  a: string
  b: string
}

/** For each key present in both decrypted lists: equal or not, with masked previews. Runs in the browser only. */
export function compareValues(
  a: { key: string; value: string }[],
  b: { key: string; value: string }[]
): ValueComparison[] {
  const inB = new Map(b.map((secret) => [secret.key, secret.value]))
  return a
    .filter((secret) => inB.has(secret.key))
    .map((secret) => {
      const other = inB.get(secret.key) as string
      return { key: secret.key, same: secret.value === other, a: maskValue(secret.value), b: maskValue(other) }
    })
}

/** Same as the CLI's `criptenv diff --show-values`: 2 first and 2 last characters, the rest hidden. */
export function maskValue(value: string): string {
  if (!value) return "<empty>"
  if (value.length <= 4) return "*".repeat(value.length)
  return `${value.slice(0, 2)}${"*".repeat(value.length - 4)}${value.slice(-2)}`
}
