import { request } from './client';
import type {
  VaultPushRequest,
  VaultPullResponse,
  VaultVersionResponse,
} from './client';

export const vaultApi = {
  push(projectId: string, environmentId: string, body: VaultPushRequest): Promise<VaultPullResponse> {
    return request('POST', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/push`, body);
  },

  pull(projectId: string, environmentId: string): Promise<VaultPullResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/pull`);
  },

  getVersion(projectId: string, environmentId: string): Promise<VaultVersionResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/version`);
  },
};
