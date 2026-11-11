import type { Credential } from "@/lib/api/me"

export const CREDENTIAL_KINDS = ["ci_token", "api_key"] as const
export const CREDENTIAL_STATUSES = ["active", "expired", "revoked"] as const

export interface CredentialFilters {
  kind: Credential["kind"] | ""
  status: Credential["status"] | ""
  project: string
}

export function filterCredentials(list: Credential[], filters: CredentialFilters): Credential[] {
  return list.filter(
    (credential) =>
      (!filters.kind || credential.kind === filters.kind) &&
      (!filters.status || credential.status === filters.status) &&
      (!filters.project || credential.project_id === filters.project)
  )
}

/** A credential that still works but has no expiry or has not been used for 30 days or more. */
export function needsAttention(credential: Credential): boolean {
  return credential.no_expiry || credential.unused
}
