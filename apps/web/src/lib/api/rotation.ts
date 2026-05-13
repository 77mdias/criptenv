import { request } from "./client";
import type {
  SecretExpirationListResponse,
  RotationResponse,
  RotationHistoryResponse,
  ExpirationResponse,
} from "./client";

export const rotationApi = {
  listExpiring(
    projectId: string,
    options: { days?: number; includeExpired?: boolean } = {},
  ): Promise<SecretExpirationListResponse> {
    return request(
      "GET",
      `/api/v1/projects/${projectId}/secrets/expiring`,
      undefined,
      {
        days: options.days ?? 30,
        include_expired: options.includeExpired ? "true" : undefined,
      },
    );
  },

  rotateSecret(
    projectId: string,
    envId: string,
    secretKey: string,
    body: {
      new_value: string;
      iv: string;
      auth_tag: string;
      reason?: string;
    },
  ): Promise<RotationResponse> {
    return request(
      "POST",
      `/api/v1/projects/${projectId}/environments/${envId}/secrets/${secretKey}/rotate`,
      body,
    );
  },

  setExpiration(
    projectId: string,
    envId: string,
    secretKey: string,
    body: {
      secret_key: string;
      expires_at: string;
      rotation_policy: string;
      notify_days_before: number;
    },
  ): Promise<ExpirationResponse> {
    return request(
      "POST",
      `/api/v1/projects/${projectId}/environments/${envId}/secrets/${secretKey}/expiration`,
      body,
    );
  },

  deleteExpiration(
    projectId: string,
    envId: string,
    secretKey: string,
  ): Promise<{ message: string; secret_key: string }> {
    return request(
      "DELETE",
      `/api/v1/projects/${projectId}/environments/${envId}/secrets/${secretKey}/expiration`,
    );
  },

  getRotationHistory(
    projectId: string,
    envId: string,
    secretKey: string,
  ): Promise<RotationHistoryResponse> {
    return request(
      "GET",
      `/api/v1/projects/${projectId}/environments/${envId}/secrets/${secretKey}/rotation/history`,
    );
  },
};
