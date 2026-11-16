import { request, twoFactorHeaders } from './client';
import type {
  VaultPushRequest,
  VaultPullResponse,
  VaultVersionResponse,
} from './client';

export const vaultApi = {
  /** `twoFactorCode` confirms a push that drops a secret, for accounts with 2FA on. */
  push(projectId: string, environmentId: string, body: VaultPushRequest, twoFactorCode?: string): Promise<VaultPullResponse> {
    return request('POST', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/push`, body, undefined, twoFactorHeaders(twoFactorCode));
  },

  pull(projectId: string, environmentId: string): Promise<VaultPullResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/pull`);
  },

  getVersion(projectId: string, environmentId: string): Promise<VaultVersionResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/version`);
  },
};
