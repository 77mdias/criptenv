"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { TaxInfo } from "@/lib/api"

export interface TaxFormValues extends TaxInfo {
  payer_email: string
}

interface TaxInfoFormProps {
  /** checkout: also asks the Mercado Pago e-mail and leads to the payment. edit: only the invoice data. */
  mode: "checkout" | "edit"
  initial: TaxFormValues
  busy: boolean
  onSubmit: (values: TaxFormValues) => void
}

/** Invoice (NFS-e) data: asked when subscribing, editable afterwards. */
export function TaxInfoForm({ mode, initial, busy, onSubmit }: TaxInfoFormProps) {
  const t = useTranslations("billing")
  const [values, setValues] = useState(initial)

  function set(field: keyof TaxFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ ...values, tax_id: values.tax_id.replace(/\D/g, "") })
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-(--text-primary)">{t("tax.title")}</h3>
      <p className="mb-4 text-sm text-(--text-secondary)">{t("tax.description")}</p>

      <form onSubmit={submit} className="space-y-4">
        <Input
          label={t("tax.taxId")}
          value={values.tax_id}
          onChange={(event) => set("tax_id", event.target.value)}
          inputMode="numeric"
          maxLength={18}
          required
        />
        <Input
          label={t("tax.legalName")}
          value={values.legal_name}
          onChange={(event) => set("legal_name", event.target.value)}
          maxLength={200}
          required
        />
        <Input
          label={t("tax.address")}
          value={values.address}
          onChange={(event) => set("address", event.target.value)}
          maxLength={500}
          required
        />
        {mode === "checkout" && (
          <Input
            label={t("tax.payerEmail")}
            type="email"
            value={values.payer_email}
            onChange={(event) => set("payer_email", event.target.value)}
            helperText={t("tax.payerEmailHint")}
            maxLength={320}
            required
          />
        )}

        {mode === "checkout" && <p className="text-xs text-(--text-muted)">{t("tax.payHint")}</p>}
        {mode === "checkout" && (
          <p className="text-xs text-(--text-muted)">
            {t.rich("tax.termsHint", {
              link: (chunks) => (
                <Link
                  href="/termos-de-uso#5-assinaturas"
                  target="_blank"
                  className="font-medium text-(--accent) underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
        <Button type="submit" loading={busy}>
          {mode === "checkout" ? t("tax.pay") : t("tax.save")}
        </Button>
      </form>
    </Card>
  )
}
