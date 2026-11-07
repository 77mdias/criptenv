import { buildApiUrl } from "@/lib/api/base-url"

export const SITE_ICONS_STORAGE_KEY = "criptenv:vault:site-icons"

// Names that only exist inside a network (or on an anonymity network): never
// send them to the server, even though it would refuse them anyway.
const PRIVATE_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".onion", ".i2p"]

/** Hostname to ask the icon route for, or null when this URL should not get an icon. */
export function iconHostname(url: string | undefined): string | null {
  const raw = url?.trim()
  if (!raw) return null
  let parsed: URL
  try {
    parsed = new URL(raw.includes("://") ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  if (!host.includes(".") || host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host)) return null
  if (host === "localhost" || PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null
  return host
}

export function siteIconSrc(hostname: string): string {
  return buildApiUrl(`/api/v1/icons/${hostname}/icon.png`)
}

/** Per-browser choice; on unless this browser saved "off". */
export function readSiteIconsSetting(): boolean {
  try {
    return localStorage.getItem(SITE_ICONS_STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function writeSiteIconsSetting(on: boolean): void {
  try {
    localStorage.setItem(SITE_ICONS_STORAGE_KEY, on ? "on" : "off")
  } catch {
    // Storage blocked (private mode, policy): the choice just lasts until reload.
  }
}
