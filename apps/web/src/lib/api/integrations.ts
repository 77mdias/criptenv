import { request } from "./client";
import type {
  CreateIntegrationRequest,
  Integration,
  IntegrationListResponse,
  IntegrationSyncRequest,
  IntegrationSyncResponse,
  UpdateIntegrationRequest,
} from "./client";

export const integrationsApi = {
  list(projectId: string): Promise<IntegrationListResponse> {
    return request("GET", `/api/v1/projects/${projectId}/integrations`);
  },

  create(projectId: string, body: CreateIntegrationRequest): Promise<Integration> {
    return request("POST", `/api/v1/projects/${projectId}/integrations`, body);
  },

  /** 402 when turning on something the plan of the project's owner lacks. */
  update(projectId: string, integrationId: string, body: UpdateIntegrationRequest): Promise<Integration> {
    return request("PATCH", `/api/v1/projects/${projectId}/integrations/${integrationId}`, body);
  },

  validate(projectId: string, integrationId: string): Promise<{ valid: boolean; error?: string | null }> {
    return request("POST", `/api/v1/projects/${projectId}/integrations/${integrationId}/validate`);
  },

  /** Answers 200 with `success: false` when the provider rejects the sync. */
  sync(projectId: string, integrationId: string, body: IntegrationSyncRequest): Promise<IntegrationSyncResponse> {
    return request("POST", `/api/v1/projects/${projectId}/integrations/${integrationId}/sync`, body);
  },

  delete(projectId: string, integrationId: string): Promise<void> {
    return request("DELETE", `/api/v1/projects/${projectId}/integrations/${integrationId}`);
  },
};
