import {
  Bell,
  FolderPlus,
  FolderX,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Link2Off,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Timer,
  TimerOff,
  Trash2,
  Upload,
  UserCheck,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { AuditLog } from "@/lib/api"
import { formatRelativeTime } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"

export type AuditTone = "success" | "info" | "warning" | "danger" | "outline"

// Literal lists (not just types) so scripts/audit-i18n-keys.mjs can resolve
// the `actors.${...}` / `actions.${...}` lookups below.
export const AUDIT_ACTOR_KINDS = ["you", "user", "ci", "api", "system"] as const
export type AuditActorKind = (typeof AUDIT_ACTOR_KINDS)[number]

export const AUDIT_MESSAGE_KEYS = [
  "alert_settings_test_webhook", "api_key_created", "api_key_revoked", "api_key_updated",
  "avatar_deleted", "avatar_updated", "environment_archived", "environment_created",
  "environment_updated", "expiration_deleted", "expiration_set", "integration_created",
  "integration_deleted", "integration_synced", "invite_accepted", "invite_created",
  "invite_deleted", "invite_revoked", "member_added", "member_removed", "member_role_changed",
  "project_alert_settings_updated", "project_created", "project_deleted", "project_updated",
  "project_vault_rekeyed", "secret_rotated", "token_created", "token_deleted", "token_revoked",
  "vault_pushed", "unknown",
] as const
type AuditMessageKey = (typeof AUDIT_MESSAGE_KEYS)[number]

// Keyed by message key (action with "." → "_"); next-intl treats "." as nesting.
export const AUDIT_ACTIONS: Record<Exclude<AuditMessageKey, "unknown">, { icon: LucideIcon; tone: AuditTone }> = {
  alert_settings_test_webhook: { icon: Bell, tone: "outline" },
  api_key_created: { icon: KeyRound, tone: "success" },
  api_key_revoked: { icon: KeyRound, tone: "danger" },
  api_key_updated: { icon: KeyRound, tone: "info" },
  avatar_deleted: { icon: ImageIcon, tone: "outline" },
  avatar_updated: { icon: ImageIcon, tone: "outline" },
  environment_archived: { icon: FolderX, tone: "warning" },
  environment_created: { icon: FolderPlus, tone: "success" },
  environment_updated: { icon: Pencil, tone: "info" },
  expiration_deleted: { icon: TimerOff, tone: "outline" },
  expiration_set: { icon: Timer, tone: "info" },
  integration_created: { icon: Link2, tone: "success" },
  integration_deleted: { icon: Link2Off, tone: "danger" },
  integration_synced: { icon: RefreshCw, tone: "info" },
  invite_accepted: { icon: UserCheck, tone: "success" },
  invite_created: { icon: UserPlus, tone: "success" },
  invite_deleted: { icon: UserMinus, tone: "danger" },
  invite_revoked: { icon: UserMinus, tone: "danger" },
  member_added: { icon: UserPlus, tone: "success" },
  member_removed: { icon: UserMinus, tone: "danger" },
  member_role_changed: { icon: RefreshCw, tone: "warning" },
  project_alert_settings_updated: { icon: Bell, tone: "info" },
  project_created: { icon: FolderPlus, tone: "success" },
  project_deleted: { icon: Trash2, tone: "danger" },
  project_updated: { icon: Pencil, tone: "info" },
  project_vault_rekeyed: { icon: ShieldCheck, tone: "warning" },
  secret_rotated: { icon: RefreshCw, tone: "warning" },
  token_created: { icon: KeyRound, tone: "success" },
  token_deleted: { icon: KeyRound, tone: "danger" },
  token_revoked: { icon: KeyRound, tone: "danger" },
  vault_pushed: { icon: Upload, tone: "info" },
}

const FALLBACK = { icon: RefreshCw, tone: "outline" as AuditTone }

export function auditMessageKey(action: string): AuditMessageKey {
  if (action.startsWith("integration.synced")) return "integration_synced"
  const key = action.replace(/\./g, "_")
  return key in AUDIT_ACTIONS ? (key as AuditMessageKey) : "unknown"
}

export function auditActionStyle(action: string) {
  const key = auditMessageKey(action)
  return key === "unknown" ? FALLBACK : AUDIT_ACTIONS[key]
}

export function auditActorKind(log: AuditLog, currentUserId?: string | null): AuditActorKind {
  if (log.auth_type === "ci_session") return "ci"
  if (log.auth_type === "api_key") return "api"
  if (!log.user_id) return "system"
  return log.user_id === currentUserId ? "you" : "user"
}

/** ICU values for the action message; every placeholder always gets a value. */
export function auditMessageValues(log: AuditLog): Record<string, string | number> {
  const meta = (log.meta ?? log.metadata ?? {}) as Record<string, unknown>
  const str = (value: unknown) => (typeof value === "string" ? value : "")
  return {
    count: typeof meta.blob_count === "number" ? meta.blob_count : 0,
    key: str(meta.secret_key),
    email: str(meta.email),
    role: str(meta.role) || str(meta.new_role),
    name: str(meta.name),
    direction: log.action.startsWith("integration.synced.") ? log.action.split(".")[2] : "",
    action: log.action,
  }
}

/** Turns an audit log into a translated sentence, its icon/tone and a relative time. */
export function useAuditDescriber() {
  const t = useTranslations("audit")
  const locale = useLocale()
  const currentUserId = useAuthStore((state) => state.user?.id)

  return useCallback(
    (log: AuditLog) => {
      const kind = auditActorKind(log, currentUserId)
      const actor = t(`actors.${kind}`, { name: log.actor?.name ?? log.actor?.email ?? "" })
      return {
        ...auditActionStyle(log.action),
        actorKind: kind,
        title: t(`actions.${auditMessageKey(log.action)}`, { ...auditMessageValues(log), actor }),
        time: formatRelativeTime(log.created_at, locale),
      }
    },
    [t, locale, currentUserId],
  )
}
