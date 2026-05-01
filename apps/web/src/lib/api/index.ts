// Re-export everything for convenient imports
export { ApiError, request } from "./client";
export type {
  User,
  AuthResponse,
  MessageResponse,
  Project,
  ProjectListResponse,
  Environment,
  EnvironmentListResponse,
  VaultBlob,
  VaultBlobPush,
  VaultPushRequest,
  VaultPullResponse,
  VaultVersionResponse,
  Member,
  MemberListResponse,
  Invite,
  InviteListResponse,
  SessionResponse,
  AuditLog,
  AuditLogListResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateEnvironmentRequest,
  UpdateMemberRequest,
  CreateInviteRequest,
  AuditQueryParams,
} from "./client";

export { authApi } from "./auth";
export { projectsApi } from "./projects";
export { environmentsApi } from "./environments";
export { vaultApi } from "./vault";
export { membersApi } from "./members";
export { auditApi } from "./audit";
export { ciTokensApi } from "./ci-tokens";
