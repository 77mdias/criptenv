// CriptEnv Base API Client
// Typed fetch wrapper for the FastAPI backend

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Error Class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
}

export interface AuthResponse {
  user: User;
  session_token: string;
}

export interface MessageResponse {
  message: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface EnvironmentListResponse {
  environments: Environment[];
}

export interface VaultBlob {
  key_id: string;
  iv: string;
  ciphertext: string;
  auth_tag: string;
}

export interface VaultPushRequest {
  blobs: VaultBlob[];
}

export interface VaultPullResponse {
  blobs: VaultBlob[];
  version: number;
}

export interface VaultVersionResponse {
  version: number;
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
  status: string;
  created_at: string;
}

export interface InviteListResponse {
  invites: Invite[];
}

export interface SessionResponse {
  id: string;
  user_id: string;
  token: string;
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
  details: unknown;
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
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
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
}

// ─── Token Helpers ─────────────────────────────────────────────────────────────

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

export function getToken(): string | null {
  return _token;
}

// ─── Base Fetch Wrapper ────────────────────────────────────────────────────────

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
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

  return data as T;
}
