"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Link, useRouter } from "@/i18n/navigation"
import { billingApi, meApi } from "@/lib/api"
import type { BillingInterval, BillingState, PaidPlan } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Plan } from "@/lib/api/me"
import { leaveTo } from "@/lib/navigate"
import { useAuthStore } from "@/stores/auth"

import { CurrentSubscription } from "./_components/current-subscription"
import { day } from "./_components/format"
import { PlanPicker } from "./_components/plan-picker"
import { TaxInfoForm, type TaxFormValues } from "./_components/tax-info-form"

function asPaidPlan(value: string | null): PaidPlan | null {
  return value === "pro" || value === "max" ? value : null
}

export default function BillingPage() {
  const t = useTranslations("billing")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = useAuthStore((store) => store.user)?.email ?? ""

  const [plan, setPlan] = useState<Plan | null>(null)
  const [state, setState] = useState<BillingState | null>(null)
  const [selected, setSelected] = useState<PaidPlan | null>(asPaidPlan(searchParams.get("plan")))
  const [interval, setCycle] = useState<BillingInterval>("month")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [editingTax, setEditingTax] = useState(false)

  function explain(cause: unknown): string {
    const status = cause instanceof ApiError ? cause.status : 0
    if (status === 409) return t("errors.conflict")
    if (status === 422) return t("errors.invalid")
    if (status === 502) return t("errors.provider")
    return t("errors.generic")
  }

  // Coming back from Mercado Pago (their return adds preapproval_id): ask them now instead of waiting for the webhook.
  const returned = searchParams.has("preapproval_id")
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const ownPlan = await meApi.plan()
        if (!active) return
        if (!ownPlan.can_upgrade) {
          router.replace("/account")
          return
        }
        setPlan(ownPlan)
        const billing = returned ? await billingApi.sync() : await billingApi.get()
        if (active) setState(billing)
      } catch {
        if (active) setError(t("errors.load"))
      }
    })()
    return () => {
      active = false
    }
  }, [returned, router, t])

  /** Run one action against the API; on failure say why and keep the page. */
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (cause) {
      setError(explain(cause))
    } finally {
      setBusy(false)
    }
  }

  const sync = () => run(async () => setState(await billingApi.sync()))

  const checkout = (values: TaxFormValues) =>
    run(async () => {
      if (!selected) return
      const { init_point } = await billingApi.checkout({ plan: selected, interval, ...values })
      leaveTo(init_point)
    })

  const saveTax = ({ tax_id, legal_name, address }: TaxFormValues) =>
    run(async () => {
      setState(await billingApi.updateTaxInfo({ tax_id, legal_name, address }))
      setEditingTax(false)
      setNotice(t("tax.saved"))
    })

  const cancel = () =>
    run(async () => {
      setConfirmingCancel(false)
      const result = await billingApi.cancel()
      const [billing, ownPlan] = await Promise.all([billingApi.get(), meApi.plan()])
      setState(billing)
      setPlan(ownPlan)
      setNotice(
        result.refunded ? t("cancel.doneRefunded") : t("cancel.doneUntil", { date: day(result.ends_at, locale) }),
      )
    })

  const subscription = state?.subscription ?? null
  const target = state?.scheduled ?? subscription
  const cancelText = state?.refund_eligible
    ? t("cancel.refund")
    : t("cancel.untilEnd", { date: day(target?.current_period_end ?? null, locale) })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <Link href="/account" className="text-sm text-(--text-secondary) hover:underline">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold text-(--text-primary)">{t("title")}</h1>
        <p className="text-sm text-(--text-secondary)">{t("subtitle")}</p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-(--text-primary)">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-(--border) bg-(--background-subtle) p-3 text-sm text-(--text-primary)">
          {notice}
        </p>
      )}

      {!plan || !state ? (
        !error && <Skeleton className="h-40 w-full" aria-label={t("loading")} />
      ) : (
        <>
          <CurrentSubscription
            plan={plan}
            state={state}
            busy={busy}
            onSync={sync}
            onCancel={() => setConfirmingCancel(true)}
          />

          <PlanPicker
            state={state}
            interval={interval}
            selected={selected}
            onInterval={setCycle}
            onSelect={setSelected}
          />

          {selected && !state.scheduled && (
            <TaxInfoForm
              key={`checkout-${selected}`}
              mode="checkout"
              busy={busy}
              onSubmit={checkout}
              initial={{
                tax_id: subscription?.tax_id ?? "",
                legal_name: subscription?.legal_name ?? "",
                address: subscription?.address ?? "",
                payer_email: subscription?.payer_email ?? email,
              }}
            />
          )}

          {subscription && !selected && (
            editingTax ? (
              <TaxInfoForm mode="edit" busy={busy} onSubmit={saveTax} initial={subscription} />
            ) : (
              <Card className="space-y-1 p-6 text-sm text-(--text-secondary)">
                <h3 className="font-semibold text-(--text-primary)">{t("tax.title")}</h3>
                <p>{subscription.legal_name}</p>
                <p className="font-mono">{subscription.tax_id}</p>
                <p>{subscription.address}</p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => setEditingTax(true)}>
                  {t("tax.edit")}
                </Button>
              </Card>
            )
          )}
        </>
      )}

      <ConfirmActionDialog
        open={confirmingCancel}
        title={t("cancel.title")}
        description={state?.scheduled ? `${cancelText} ${t("cancel.scheduledNote")}` : cancelText}
        confirmLabel={t("cancel.confirm")}
        cancelLabel={t("cancel.keep")}
        destructive
        loading={busy}
        onConfirm={cancel}
        onOpenChange={setConfirmingCancel}
      />
    </div>
  )
}
