// CriptEnv Base API Client
// Typed fetch wrapper for the FastAPI backend

import { API_BASE_URL } from "./base-url";

// Use relative URL in development if no public API URL is configured.
const BASE_URL = API_BASE_URL;
const GET_CACHE_TTL_MS = 15_000;

interface CacheEntry {
  data?: unknown;
  expiresAt: number;
  promise?: Promise<unknown>;
  generation: number;
}

const responseCache = new Map<string, CacheEntry>();
let cacheGeneration = 0;

// ─── Error Class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  kdf_salt: string;
  created_at: string;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
}

export interface AuthResponse {
  user: User;
  session: SessionResponse;
}

export interface MessageResponse {
  message: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  slug?: string;
  description: string | null;
  vault_config?: ProjectVaultConfig | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectVaultConfig {
  version: number;
  kdf: string;
  iterations: number;
  salt: string;
  proof_salt: string;
  verifier_iv: string;
  verifier_ciphertext: string;
  verifier_auth_tag: string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  display_name: string | null;
  is_default?: boolean;
  secrets_count?: number;
  secrets_version?: number;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentListResponse {
  environments: Environment[];
  total?: number;
}

export interface VaultBlob {
  id: string;
  project_id: string;
  environment_id: string;
  key_id: string;
  iv: string;
  ciphertext: string;
  auth_tag: string;
  version: number;
  checksum: string;
  created_at: string;
  updated_at: string | null;
}

export interface VaultBlobPush {
  key_id: string;
  iv: string;
  ciphertext: string;
  auth_tag: string;
  checksum: string;
  version: number;
}

export interface VaultPushRequest {
  blobs: VaultBlobPush[];
  vault_proof?: string;
}

export interface VaultPullResponse {
  blobs: VaultBlob[];
  version: number;
}

export interface VaultVersionResponse {
  version: number;
  blob_count: number;
}

export interface Member {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface MemberListResponse {
  members: Member[];
}

export interface Invite {
  id: string;
  project_id: string;
  email: string;
  role: string;
  invited_by?: string | null;
  token?: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  status?: string;
  created_at: string;
}

export interface InviteListResponse {
  invites: Invite[];
}

export interface SessionResponse {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditLog {
  id: string;
  project_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  meta?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  vault_config: ProjectVaultConfig;
  vault_proof: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export interface VaultRekeyEnvironmentPayload {
  environment_id: string;
  blobs: VaultBlobPush[];
}

export interface VaultRekeyRequest {
  current_vault_proof: string;
  new_vault_config: ProjectVaultConfig;
  new_vault_proof: string;
  environments: VaultRekeyEnvironmentPayload[];
}

export interface CreateEnvironmentRequest {
  name: string;
  display_name?: string;
}

export interface UpdateMemberRequest {
  role: string;
}

export interface CreateInviteRequest {
  email: string;
  role: string;
}

export interface AuditQueryParams {
  page?: number;
  per_page?: number;
  action?: string;
  resource_type?: string;
}

// ─── CI Tokens ───────────────────────────────────────────────────────────────

export interface CIToken {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  scopes: string[];
  environment_scope: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CITokenListResponse {
  tokens: CIToken[];
  total: number;
}

export interface CITokenWithPlaintext {
  token: string;
  token_info: CIToken;
}

export interface CreateCITokenRequest {
  name: string;
  description?: string;
  scopes: string[];
  environment_scope?: string;
  expires_at?: string;
}

// ─── API Keys ───────────────────────────────────────────────────────────────

export interface APIKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  environment_scope: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface APIKeyListResponse {
  items: APIKey[];
  total: number;
}

export interface APIKeyCreateResponse {
  id: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  environment_scope: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreateAPIKeyRequest {
  name: string;
  description?: string;
  scopes: string[];
  environment_scope?: string;
  expires_in_days?: number;
}

// ─── Secret Expiration / Rotation ───────────────────────────────────────────

export interface SecretExpiration {
  id: string;
  secret_key: string;
  expires_at: string;
  rotation_policy: string;
  notify_days_before: number;
  last_notified_at: string | null;
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
  project_id: string;
  environment_id: string;
  is_expired: boolean | null;
  days_until_expiration: number | null;
}

export interface SecretExpirationListResponse {
  items: SecretExpiration[];
  total: number;
  page: number;
  page_size: number;
}

export interface RotationResponse {
  rotation_id: string;
  secret_key: string;
  rotated_at: string;
  new_version: number;
  previous_version: number;
}

export interface RotationHistoryItem {
  id: string;
  secret_key: string;
  previous_version: number;
  new_version: number;
  rotated_by: string;
  rotated_at: string;
  reason: string | null;
}

export interface RotationHistoryResponse {
  items: RotationHistoryItem[];
  total: number;
}

export interface ExpirationResponse {
  id: string;
  secret_key: string;
  expires_at: string;
  rotation_policy: string;
  notify_days_before: number;
  last_notified_at: string | null;
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
  project_id: string;
  environment_id: string;
  is_expired: boolean | null;
  days_until_expiration: number | null;
}

// ─── Integrations ───────────────────────────────────────────────────────────

export interface Integration {
  id: string;
  project_id: string;
  provider: string;
  name: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface IntegrationListResponse {
  integrations: Integration[];
  total: number;
  available_providers: string[];
}

export interface CreateIntegrationRequest {
  provider: "vercel";
  name: string;
  config: {
    api_token: string;
    project_id: string;
  };
}

// ─── Base Fetch Wrapper ────────────────────────────────────────────────────────

function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined>,
): URL {
  const baseUrl = BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const url = new URL(`${baseUrl}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

function invalidateCache() {
  cacheGeneration += 1;
  responseCache.clear();
}

export function peekCached<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): T | null {
  const key = buildUrl(path, params).toString();
  const cached = responseCache.get(key);

  if (!cached || cached.data === undefined || cached.expiresAt <= Date.now()) {
    return null;
  }

  return cached.data as T;
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = buildUrl(path, params);
  const cacheKey = url.toString();
  const requestGeneration = cacheGeneration;

  if (method === "GET" && typeof window !== "undefined") {
    const cached = responseCache.get(cacheKey);

    if (cached?.data !== undefined && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    if (cached?.promise) {
      return cached.promise as Promise<T>;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const fetchPromise = (async () => {
    const res = await fetch(cacheKey, {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) {
      if (method !== "GET") {
        invalidateCache();
      }
      return undefined as T;
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new ApiError(
        (data as { detail?: string })?.detail || `Request failed: ${res.status}`,
        res.status,
        data,
      );
    }

    if (
      method === "GET" &&
      typeof window !== "undefined" &&
      requestGeneration === cacheGeneration
    ) {
      responseCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
        generation: cacheGeneration,
      });
    } else if (method !== "GET") {
      invalidateCache();
    }

    return data as T;
  })();

  if (method === "GET" && typeof window !== "undefined") {
    responseCache.set(cacheKey, {
      expiresAt: Date.now() + GET_CACHE_TTL_MS,
      promise: fetchPromise,
      generation: requestGeneration,
    });
  }

  try {
    return await fetchPromise;
  } catch (error) {
    if (method === "GET" && typeof window !== "undefined") {
      const cached = responseCache.get(cacheKey);
      if (cached?.generation === requestGeneration) {
        responseCache.delete(cacheKey);
      }
    }
    throw error;
  }
}
