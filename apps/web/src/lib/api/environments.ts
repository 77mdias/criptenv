import { request } from './client';
import type {
  Environment,
  EnvironmentListResponse,
  CreateEnvironmentRequest,
} from './client';

export const environmentsApi = {
  list(projectId: string): Promise<EnvironmentListResponse> {
    return request('GET', `/api/v1/projects/${projectId}/environments`);
  },

  create(projectId: string, body: CreateEnvironmentRequest): Promise<Environment> {
    return request('POST', `/api/v1/projects/${projectId}/environments`, body);
  },

  update(projectId: string, envId: string, body: Partial<CreateEnvironmentRequest>): Promise<Environment> {
    return request('PATCH', `/api/v1/projects/${projectId}/environments/${envId}`, body);
  },

  delete(projectId: string, envId: string): Promise<void> {
    return request('DELETE', `/api/v1/projects/${projectId}/environments/${envId}`);
  },
};
