import { request } from "./client";
import type {
  CITokenListResponse,
  CITokenWithPlaintext,
  CreateCITokenRequest,
} from "./client";

export const ciTokensApi = {
  list(
    projectId: string,
    includeRevoked = false,
  ): Promise<CITokenListResponse> {
    return request("GET", `/api/v1/projects/${projectId}/tokens`, undefined, {
      include_revoked: includeRevoked ? "true" : undefined,
    });
  },

  create(
    projectId: string,
    body: CreateCITokenRequest,
  ): Promise<CITokenWithPlaintext> {
    return request("POST", `/api/v1/projects/${projectId}/tokens`, body);
  },

  revoke(projectId: string, tokenId: string): Promise<void> {
    return request(
      "POST",
      `/api/v1/projects/${projectId}/tokens/${tokenId}/revoke`,
    );
  },

  delete(projectId: string, tokenId: string): Promise<void> {
    return request("DELETE", `/api/v1/projects/${projectId}/tokens/${tokenId}`);
  },
};
