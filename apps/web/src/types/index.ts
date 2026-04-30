export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  two_factor_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  settings: Record<string, unknown>
  archived: boolean
  secrets_count?: number
  members_count?: number
  environments_count?: number
  created_at: string
  updated_at: string
}

export interface Environment {
  id: string
  project_id: string
  name: string
  display_name: string | null
  is_default: boolean
  secrets_version: number
  secrets_count?: number
  created_at: string
  updated_at: string
}

export interface Secret {
  id: string
  key: string
  value: string // masked in UI, encrypted in DB
  environment: string
  updated_at: string
  updated_by?: string
  is_stale?: boolean
}

export interface AuditEvent {
  id: string
  user_id: string | null
  user_email?: string
  user_name?: string
  project_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface ProjectMember {
  id: string
  user_id: string
  email: string
  name: string
  role: "owner" | "admin" | "developer" | "viewer"
  invited_by: string | null
  joined_at: string
  accepted_at: string | null
}

export interface ProjectInvite {
  id: string
  email: string
  role: "admin" | "developer" | "viewer"
  expires_at: string
  created_at: string
}

export type AuditAction =
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "env.created"
  | "env.deleted"
  | "secret.created"
  | "secret.updated"
  | "secret.deleted"
  | "secret.viewed"
  | "vault.pushed"
  | "vault.pulled"
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.role_updated"
  | "token.created"
  | "token.revoked"

export type MemberRole = "owner" | "admin" | "developer" | "viewer"
