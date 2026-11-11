import type { AuditLog } from "@/lib/api"

const COLUMNS = ["timestamp", "project", "action", "origin", "actor", "resource_type", "resource_id"]

/** Quoted CSV cell. A leading =, +, -, @, tab or CR is prefixed with ' so a spreadsheet shows it as text. */
function cell(value: string | null | undefined): string {
  let text = value ?? ""
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

/** Audit events as CSV, one row per event, newest first as given. */
export function toAuditCsv(logs: AuditLog[], projectNames: Map<string, string>): string {
  const rows = logs.map((log) =>
    [
      log.created_at,
      projectNames.get(log.project_id) ?? log.project_id,
      log.action,
      log.auth_type ?? "session",
      log.actor?.name ?? log.actor?.email ?? "",
      log.resource_type,
      log.resource_id,
    ]
      .map(cell)
      .join(","),
  )
  return [COLUMNS.join(","), ...rows].join("\n")
}
