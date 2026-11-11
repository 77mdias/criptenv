import { request } from "./client";
import type { AuditLogListResponse } from "./client";

export interface OverviewEnvironment {
  id: string;
  name: string;
  is_default: boolean;
  secret_count: number;
  /** Secrets of this environment when it got no push for 90 days or more. */
  stale_secret_count: number;
  version: number;
  updated_at: string | null;
}

export interface OverviewProject {
  id: string;
  name: string;
  slug: string;
  role: string;
  member_count: number;
  /** Owner plus admins. */
  manager_count: number;
  last_activity_at: string | null;
  environments: OverviewEnvironment[];
}

export interface AttentionExpiration {
  project_id: string;
  environment_id: string;
  environment_name: string;
  secret_key: string;
  expires_at: string;
}

export interface AttentionInvite {
  project_id: string;
  id: string;
  email: string;
  role: string;
  expires_at: string;
}

export interface AttentionCredential {
  project_id: string;
  id: string;
  kind: "ci_token" | "api_key";
  name: string;
  reason: "no_expiry" | "unused";
  last_used_at: string | null;
  expires_at: string | null;
}

export interface AttentionIntegration {
  project_id: string;
  id: string;
  provider: string;
  name: string;
  last_error: string | null;
}

export interface OverviewResponse {
  projects: OverviewProject[];
  attention: {
    expired: AttentionExpiration[];
    expiring: AttentionExpiration[];
    pending_invites: AttentionInvite[];
    stale_credentials: AttentionCredential[];
    failing_integrations: AttentionIntegration[];
  };
  totals: { projects: number; secrets: number; members: number };
}

export interface ActivityDay {
  date: string;
  changes: number;
  other: number;
}

export type PlanLimitKey =
  | "projects"
  | "environments_per_project"
  | "members_per_project"
  | "integrations_per_project"
  | "audit_retention_days"
  | "personal_vault_items"
  | "personal_vault_folders";

/** A user's own plan (meApi.plan) or the plan of a project's owner (projectsApi.plan). */
export interface Plan {
  id: string;
  /** null = no limit on this plan. */
  limits: Record<PlanLimitKey, number | null>;
  features: string[];
  /** Only the limits that apply to the scope asked for (the user, or one project). */
  usage: Partial<Record<PlanLimitKey, number>>;
  /** Billing is on and this plan is the caller's own to change (false for a member of someone else's project). */
  can_upgrade?: boolean;
  /** Set while a charge is overdue: the plan holds until this date. Only on the caller's own plan. */
  grace_until?: string | null;
}

export const meApi = {
  plan(): Promise<Plan> {
    return request<Plan>("GET", "/api/v1/me/plan");
  },


  overview(): Promise<OverviewResponse> {
    return request<OverviewResponse>("GET", "/api/v1/me/overview");
  },

  activityStats(days = 30): Promise<ActivityDay[]> {
    return request<ActivityDay[]>("GET", "/api/v1/me/activity-stats", undefined, { days });
  },

  /** CI tokens and API keys of the projects the user manages (owner/admin). */
  credentials(): Promise<CredentialListResponse> {
    return request<CredentialListResponse>("GET", "/api/v1/me/credentials");
  },

  /** Audit events of every project the user belongs to, newest first. */
  audit(params: MyAuditQuery = {}): Promise<AuditLogListResponse> {
    return request<AuditLogListResponse>(
      "GET",
      "/api/v1/me/audit",
      undefined,
      params as Record<string, string | number | undefined>,
    );
  },
};

export type AuditOrigin = "session" | "ci_session" | "api_key";

export interface Credential {
  kind: "ci_token" | "api_key";
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  scopes: string[];
  environment_scope: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
  status: "active" | "expired" | "revoked";
  /** Set only while the credential still works. */
  no_expiry: boolean;
  /** Not used for 30 days or more (set only while it still works). */
  unused: boolean;
}

export interface CredentialListResponse {
  credentials: Credential[];
}

export interface MyAuditQuery {
  page?: number;
  per_page?: number;
  project_id?: string;
  action?: string;
  auth_type?: AuditOrigin;
  actor_id?: string;
  /** ISO date-time; events at or after it. */
  from?: string;
  /** ISO date-time; events at or before it. */
  to?: string;
}
