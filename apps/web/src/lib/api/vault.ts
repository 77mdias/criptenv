import { request, twoFactorHeaders } from './client';
import type {
  VaultPushRequest,
  VaultPullResponse,
  VaultResolvedResponse,
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

  /** The environment resolved through its parents; each blob says which environment holds it. Read-only. */
  resolved(projectId: string, environmentId: string): Promise<VaultResolvedResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/resolved`);
  },

  getVersion(projectId: string, environmentId: string): Promise<VaultVersionResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments/${environmentId}/vault/version`);
  },
};
