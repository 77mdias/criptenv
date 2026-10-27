import type { MatrixCell, SecretMatrixResponse } from "@/lib/api/projects"

export interface MatrixRow {
  key: string
  /** one entry per environment column, in `matrix.environments` order */
  cells: (MatrixCell | null)[]
  missingIn: number
}

export function matrixRows(matrix: SecretMatrixResponse, onlyMissing: boolean): MatrixRow[] {
  const rows = matrix.keys.map((key) => {
    const cells = matrix.environments.map((env) => key.cells[env.id] ?? null)
    return { key: key.key_id, cells, missingIn: cells.filter((cell) => cell === null).length }
  })
  return onlyMissing ? rows.filter((row) => row.missingIn > 0) : rows
}
