import { request } from './client';
import type {
  Project,
  ProjectListResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  VaultRekeyRequest,
} from './client';

export interface MatrixCell {
  version: number;
  updated_at: string | null;
}

export interface SecretMatrixResponse {
  environments: { id: string; name: string; is_default: boolean }[];
  /** cells: environment id -> cell, or null when the key is missing there */
  keys: { key_id: string; cells: Record<string, MatrixCell | null> }[];
}

export const projectsApi = {
  list(): Promise<ProjectListResponse> {
    return request('GET', '/api/v1/projects');
  },

  get(id: string): Promise<Project> {
    return request('GET', `/api/v1/projects/${id}`);
  },

  secretMatrix(id: string): Promise<SecretMatrixResponse> {
    return request('GET', `/api/v1/projects/${id}/secrets/matrix`);
  },

  create(body: CreateProjectRequest): Promise<Project> {
    return request('POST', '/api/v1/projects', body);
  },

  update(id: string, body: UpdateProjectRequest): Promise<Project> {
    return request('PATCH', `/api/v1/projects/${id}`, body);
  },

  rekeyVault(id: string, body: VaultRekeyRequest): Promise<Project> {
    return request('POST', `/api/v1/projects/${id}/vault/rekey`, body);
  },

  delete(id: string): Promise<void> {
    return request('DELETE', `/api/v1/projects/${id}`);
  },
};
