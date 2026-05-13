// Re-export everything for convenient imports
export { ApiError, peekCached, request } from "./client";
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
  VaultRekeyRequest,
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
  ProjectVaultConfig,
  UpdateProjectRequest,
  CreateEnvironmentRequest,
  UpdateMemberRequest,
  CreateInviteRequest,
  AuditQueryParams,
  SecretExpiration,
  SecretExpirationListResponse,
  RotationResponse,
  RotationHistoryResponse,
  RotationHistoryItem,
  ExpirationResponse,
  APIKey,
  APIKeyListResponse,
  APIKeyCreateResponse,
  CreateAPIKeyRequest,
  Integration,
  IntegrationListResponse,
  CreateIntegrationRequest,
} from "./client";

export { authApi } from "./auth";
export { projectsApi } from "./projects";
export { environmentsApi } from "./environments";
export { vaultApi } from "./vault";
export { membersApi } from "./members";
export { auditApi } from "./audit";
export { ciTokensApi } from "./ci-tokens";
export { rotationApi } from "./rotation";
export { apiKeysApi } from "./api-keys";
export { integrationsApi } from "./integrations";
