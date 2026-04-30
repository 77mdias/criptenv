import { request } from './client';
import type {
  Project,
  ProjectListResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
} from './client';

export const projectsApi = {
  list(): Promise<ProjectListResponse> {
    return request('GET', '/api/v1/projects');
  },

  get(id: string): Promise<Project> {
    return request('GET', `/api/v1/projects/${id}`);
  },

  create(body: CreateProjectRequest): Promise<Project> {
    return request('POST', '/api/v1/projects', body);
  },

  update(id: string, body: UpdateProjectRequest): Promise<Project> {
    return request('PATCH', `/api/v1/projects/${id}`, body);
  },

  delete(id: string): Promise<void> {
    return request('DELETE', `/api/v1/projects/${id}`);
  },
};
