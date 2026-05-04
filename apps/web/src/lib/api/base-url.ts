const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? ""

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "")

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
