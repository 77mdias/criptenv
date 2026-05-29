export type ProjectRole = "owner" | "admin" | "developer" | "viewer"

export const ADMIN_PROJECT_ROLES: ProjectRole[] = ["owner", "admin"]
export const WRITER_PROJECT_ROLES: ProjectRole[] = ["owner", "admin"]
export const INVITER_PROJECT_ROLES: ProjectRole[] = ["owner", "admin", "developer"]

export function canManageProject(role?: string | null): boolean {
  return role === "owner" || role === "admin"
}

export function canWriteProjectSecrets(role?: string | null): boolean {
  return canManageProject(role)
}

export function canInviteProjectMembers(role?: string | null): boolean {
  return role === "owner" || role === "admin" || role === "developer"
}

export function getInviteRoleOptions(role?: string | null): ProjectRole[] {
  if (canManageProject(role)) {
    return ["viewer", "developer", "admin"]
  }

  if (role === "developer") {
    return ["viewer", "developer"]
  }

  return []
}
