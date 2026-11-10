import { request } from "./client";

export type PaidPlan = "pro" | "max";
export type BillingInterval = "month" | "year";

/** Invoice (NFS-e) data kept with the subscription. */
export interface TaxInfo {
  tax_id: string;
  legal_name: string;
  address: string;
}

export interface CheckoutRequest extends TaxInfo {
  plan: PaidPlan;
  interval: BillingInterval;
  /** The e-mail of the buyer's Mercado Pago account. */
  payer_email: string;
}

export interface Subscription extends TaxInfo {
  id: string;
  plan: PaidPlan;
  interval: BillingInterval;
  /** pending: waiting for the first payment. scheduled: paid, starts when the current one ends. */
  status: "pending" | "scheduled" | "active" | "past_due" | "ended";
  /** Price of one cycle, in BRL ("29.00"). */
  amount: string;
  /** Already cancelled: the plan holds until current_period_end. */
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  /** Set while a charge is overdue: the plan holds until this date. */
  grace_until: string | null;
  /** Where to pay (Mercado Pago). */
  init_point: string | null;
  payer_email: string;
}

export interface BillingState {
  prices: Record<PaidPlan, Record<BillingInterval, string>>;
  /** The subscription in force. */
  subscription: Subscription | null;
  /** A paid plan change that starts when the current period ends. */
  scheduled: Subscription | null;
  /** An open checkout. */
  pending: Subscription | null;
  /** A cancel now gives the money back. */
  refund_eligible: boolean;
}

export interface CancelResult {
  refunded: boolean;
  /** Until when the plan holds; null when it ended now. */
  ends_at: string | null;
}

/** Every route answers 404 while billing is off (see `Plan.can_upgrade`). */
export const billingApi = {
  get(): Promise<BillingState> {
    return request("GET", "/api/v1/billing");
  },

  /** 409 when the plan is already in force or a change is scheduled; 502 when Mercado Pago is down. */
  checkout(body: CheckoutRequest): Promise<{ init_point: string }> {
    return request("POST", "/api/v1/billing/checkout", body);
  },

  cancel(): Promise<CancelResult> {
    return request("POST", "/api/v1/billing/cancel");
  },

  /** Re-reads Mercado Pago now: the return from their checkout, or "I already paid". */
  sync(): Promise<BillingState> {
    return request("POST", "/api/v1/billing/sync");
  },

  updateTaxInfo(body: TaxInfo): Promise<BillingState> {
    return request("PATCH", "/api/v1/billing/tax-info", body);
  },
};
