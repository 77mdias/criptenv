import { request } from './client';
import type { APIKeyListResponse, APIKeyCreateResponse, CreateAPIKeyRequest } from './client';

export const apiKeysApi = {
  list(projectId: string): Promise<APIKeyListResponse> {
    return request('GET', `/api/v1/projects/${projectId}/api-keys`);
  },

  create(projectId: string, body: CreateAPIKeyRequest): Promise<APIKeyCreateResponse> {
    return request('POST', `/api/v1/projects/${projectId}/api-keys`, body);
  },

  revoke(projectId: string, keyId: string): Promise<void> {
    return request('DELETE', `/api/v1/projects/${projectId}/api-keys/${keyId}`);
  },
};
