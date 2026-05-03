// CriptEnv API Client — backward-compatible facade
// Re-exports from modular api/ directory plus the legacy `api` object

export { ApiError, peekCached, request } from './api/client';
export { authApi } from './api/auth';
export { projectsApi } from './api/projects';
export { environmentsApi } from './api/environments';
export { vaultApi } from './api/vault';
export { membersApi } from './api/members';
export { auditApi } from './api/audit';
export { ciTokensApi } from './api/ci-tokens';
export { rotationApi } from './api/rotation';
export { integrationsApi } from './api/integrations';

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
  SecretExpiration,
  SecretExpirationListResponse,
  Integration,
  IntegrationListResponse,
  CreateIntegrationRequest,
} from './api/client';

// Legacy `api` object — still used by some components
import { authApi } from './api/auth';
import { projectsApi } from './api/projects';
import { environmentsApi } from './api/environments';
import { vaultApi } from './api/vault';
import { membersApi } from './api/members';
import { auditApi } from './api/audit';
import { ciTokensApi } from './api/ci-tokens';
import { rotationApi } from './api/rotation';
import { integrationsApi } from './api/integrations';

export const api = {
  auth: authApi,
  projects: projectsApi,
  environments: environmentsApi,
  vault: vaultApi,
  members: membersApi,
  audit: auditApi,
  ciTokens: ciTokensApi,
  rotation: rotationApi,
  integrations: integrationsApi,
};
