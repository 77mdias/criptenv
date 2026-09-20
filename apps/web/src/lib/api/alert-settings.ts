import { request } from "./client"

export interface AlertChannels {
  in_app: boolean
  email: boolean
  webhook: boolean
}

export interface AlertSettingsResponse {
  enabled: boolean
  default_notify_days_before: number
  channels: AlertChannels
  webhook_url_preview: string | null
  webhook_configured: boolean
}

export interface AlertSettingsUpdate {
  enabled?: boolean
  default_notify_days_before?: number
  channels?: AlertChannels
  webhook_url?: string | null
}

export interface TestWebhookResponse {
  success: boolean
}

export const alertSettingsApi = {
  get(projectId: string): Promise<AlertSettingsResponse> {
    return request("GET", `/api/v1/projects/${projectId}/alert-settings`)
  },

  update(projectId: string, body: AlertSettingsUpdate): Promise<AlertSettingsResponse> {
    return request("PATCH", `/api/v1/projects/${projectId}/alert-settings`, body)
  },

  testWebhook(projectId: string): Promise<TestWebhookResponse> {
    return request("POST", `/api/v1/projects/${projectId}/alert-settings/test-webhook`)
  },
}
