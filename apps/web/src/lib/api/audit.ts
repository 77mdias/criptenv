import { request } from './client';
import type { AuditLogListResponse, AuditQueryParams } from './client';

export const auditApi = {
  getLogs(projectId: string, params?: AuditQueryParams): Promise<AuditLogListResponse> {
    return request(
      'GET',
      `/api/v1/projects/${projectId}/audit`,
      undefined,
      params as Record<string, string | number | undefined>,
    );
  },
};
