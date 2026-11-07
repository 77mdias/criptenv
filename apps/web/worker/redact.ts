// Site icon requests carry a vault login's hostname in the path
// (/api/v1/icons/<hostname>/icon.png); it must never reach a log line.
const ICON_PATH = /\/api\/v1\/icons\/[^/?#\s]+/g

export function redactIconPath(text: string): string {
  return text.replace(ICON_PATH, "/api/v1/icons/[oculto]")
}
