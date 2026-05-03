import { request } from "./client";
import type {
  CreateIntegrationRequest,
  Integration,
  IntegrationListResponse,
} from "./client";

export const integrationsApi = {
  list(projectId: string): Promise<IntegrationListResponse> {
    return request("GET", `/api/v1/projects/${projectId}/integrations`);
  },

  create(projectId: string, body: CreateIntegrationRequest): Promise<Integration> {
    return request("POST", `/api/v1/projects/${projectId}/integrations`, body);
  },

  validate(projectId: string, integrationId: string): Promise<{ valid: boolean; error?: string | null }> {
    return request("POST", `/api/v1/projects/${projectId}/integrations/${integrationId}/validate`);
  },

  delete(projectId: string, integrationId: string): Promise<void> {
    return request("DELETE", `/api/v1/projects/${projectId}/integrations/${integrationId}`);
  },
};
