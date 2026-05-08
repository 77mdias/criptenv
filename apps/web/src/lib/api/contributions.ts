import { request } from "./client"

export interface CreateContributionRequest {
  amount: number
  payer_name?: string
  payer_email?: string
}

export interface ContributionPixResponse {
  contribution_id: string
  status: string
  amount: number
  pix_copy_paste: string
  pix_qr_code_base64: string
  expires_at: string
}

export interface ContributionStatusResponse {
  contribution_id: string
  status: string
  amount: number
  provider_payment_id: string | null
  paid_at: string | null
  refunded_at: string | null
  cancelled_at: string | null
  expires_at: string | null
}

export const contributionsApi = {
  createPixContribution(body: CreateContributionRequest): Promise<ContributionPixResponse> {
    return request("POST", "/api/v1/contributions/pix", body)
  },

  getContributionStatus(contributionId: string): Promise<ContributionStatusResponse> {
    return request("GET", `/api/v1/contributions/${contributionId}/status`)
  },

  syncContributionStatus(contributionId: string): Promise<ContributionStatusResponse> {
    return request("POST", `/api/v1/contributions/${contributionId}/sync`)
  },
}
