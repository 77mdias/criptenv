import * as React from "react"
import { cn } from "@/lib/utils"

interface Param {
  name: string
  type: string
  required?: boolean
  default?: string
  description: string
}

interface ParamTableProps {
  params?: Param[]
  rows?: Param[]
  title?: string
  className?: string
}

function ParamTable({ params, rows, title, className }: ParamTableProps) {
  const items = params || rows
  if (!items || items.length === 0) return null
  return (
    <div className={cn("my-4 overflow-x-auto rounded-lg border border-[var(--border)]", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
            <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Parâmetro</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Tipo</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {items.map((param, index) => (
            <tr
              key={param.name}
              className={cn(
                "border-b border-[var(--border)] last:border-0",
                index % 2 === 0 ? "bg-transparent" : "bg-[var(--background-subtle)]"
              )}
            >
              <td className="px-4 py-3">
                <code className="text-sm font-mono text-emerald-500">{param.name}</code>
                {param.required && (
                  <span className="ml-1.5 text-[10px] font-bold text-red-500 uppercase">obrigatório</span>
                )}
              </td>
              <td className="px-4 py-3">
                <code className="text-xs font-mono text-[var(--text-tertiary)] bg-[var(--background-muted)] px-1.5 py-0.5 rounded">
                  {param.type}
                </code>
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                {param.description}
                {param.default && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    Padrão: <code className="font-mono">{param.default}</code>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface StatusTableProps {
  codes: { code: string; meaning: string }[]
  className?: string
}

function StatusTable({ codes, className }: StatusTableProps) {
  return (
    <div className={cn("my-4 overflow-x-auto rounded-lg border border-[var(--border)]", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
            <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Código</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Significado</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((item, index) => (
            <tr
              key={item.code}
              className={cn(
                "border-b border-[var(--border)] last:border-0",
                index % 2 === 0 ? "bg-transparent" : "bg-[var(--background-subtle)]"
              )}
            >
              <td className="px-4 py-3">
                <code className={cn(
                  "text-sm font-mono font-bold px-1.5 py-0.5 rounded",
                  item.code.startsWith("2") && "text-emerald-500 bg-emerald-500/10",
                  item.code.startsWith("4") && "text-amber-500 bg-amber-500/10",
                  item.code.startsWith("5") && "text-red-500 bg-red-500/10"
                )}>
                  {item.code}
                </code>
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                {item.meaning}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { ParamTable, StatusTable }
