import { request } from './client';
import type {
  VaultPushRequest,
  VaultPullResponse,
  VaultVersionResponse,
} from './client';

export const vaultApi = {
  push(projectId: string, envName: string, body: VaultPushRequest): Promise<VaultPullResponse> {
    return request('POST', `/api/v1/projects/${projectId}/environments/${envName}/vault/push`, body);
  },

  pull(projectId: string, envName: string): Promise<VaultPullResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${envName}/vault/pull`);
  },

  getVersion(projectId: string, envName: string): Promise<VaultVersionResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${envName}/vault/version`);
  },
};
