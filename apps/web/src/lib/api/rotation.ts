import { request } from "./client";
import type { SecretExpirationListResponse } from "./client";

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
};
