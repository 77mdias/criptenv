"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createProjectSchema, type CreateProjectInput } from "@/lib/validators/schemas"
import { projectsApi } from "@/lib/api"
import { isPlanLimitError } from "@/lib/api/client"
import { meApi, type Plan } from "@/lib/api/me"
import { isPlanFull, PlanUsage } from "@/components/shared/plan-usage"
import { buildProjectVaultConfig } from "@/lib/crypto"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
  const t = useTranslations("dashboard.createDialog")
  const tDash = useTranslations("dashboard")
  const descriptionId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // null = unknown (not loaded or failed): no usage shown and nothing disabled; the API still enforces the limit.
  const [plan, setPlan] = useState<Plan | null>(null)
  const [limitHit, setLimitHit] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    meApi
      .plan()
      .then((value) => !cancelled && setPlan(value))
      .catch(() => !cancelled && setPlan(null))
    return () => {
      cancelled = true
    }
  }, [open])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    // Built per locale: Zod bakes messages in at construction time.
    resolver: zodResolver(useMemo(() => createProjectSchema(tDash), [tDash])),
  })

  const onSubmit = async (data: CreateProjectInput) => {
    setLoading(true)
    setError(null)
    setLimitHit(false)
    try {
      const { vaultConfig, vaultProof } = await buildProjectVaultConfig(data.vaultPassword)
      await projectsApi.create({
        name: data.name,
        description: data.description,
        vault_config: vaultConfig,
        vault_proof: vaultProof,
      })
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      if (isPlanLimitError(err)) setLimitHit(true)
      else setError(err instanceof Error ? err.message : t("error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
              <FolderPlus className="h-5 w-5 text-[var(--text-tertiary)]" />
            </div>
            <div>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("subtitle")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t("nameLabel")}
            placeholder="my-api"
            error={errors.name?.message}
            {...register("name")}
          />

          <div className="space-y-1.5">
            <label
              htmlFor={descriptionId}
              className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono"
            >
              {t("descriptionLabel")}
            </label>
            <textarea
              id={descriptionId}
              className="flex min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              placeholder={t("descriptionPlaceholder")}
              {...register("description")}
            />
            {errors.description?.message && (
              <p className="text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          <Input
            label={t("vaultPasswordLabel")}
            type="password"
            autoComplete="new-password"
            error={errors.vaultPassword?.message}
            {...register("vaultPassword")}
          />

          <Input
            label={t("confirmVaultPasswordLabel")}
            type="password"
            autoComplete="new-password"
            error={errors.confirmVaultPassword?.message}
            {...register("confirmVaultPassword")}
          />

          {error && (
            <p className="text-xs text-red-600 font-mono">{error}</p>
          )}

          <PlanUsage plan={plan} limitKey="projects" limitHit={limitHit} />

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" loading={loading} icon={FolderPlus} disabled={isPlanFull(plan, "projects")}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
