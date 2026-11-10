/**
 * Prices in BRL for the public pricing section only. The API is what charges
 * (apps/api/app/plans.py PRICES) and the billing screen shows the API's prices.
 */
export const PLAN_PRICES = {
  pro: { month: 29, year: 290 },
  max: { month: 69, year: 690 },
} as const
