"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createProjectSchema, type CreateProjectInput } from "@/lib/validators/schemas"
import { projectsApi } from "@/lib/api"
import { buildProjectVaultConfig } from "@/lib/crypto"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
  })

  const onSubmit = async (data: CreateProjectInput) => {
    setLoading(true)
    setError(null)
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
      setError(err instanceof Error ? err.message : "Erro ao criar projeto")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
            <FolderPlus className="h-5 w-5 text-[var(--text-tertiary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Novo Projeto
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Crie um novo projeto para gerenciar seus secrets
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome do projeto"
            placeholder="my-api"
            error={errors.name?.message}
            {...register("name")}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Descrição
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              placeholder="Descrição opcional do projeto"
              {...register("description")}
            />
            {errors.description?.message && (
              <p className="text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          <Input
            label="Senha do vault"
            type="password"
            autoComplete="new-password"
            error={errors.vaultPassword?.message}
            {...register("vaultPassword")}
          />

          <Input
            label="Confirmar senha do vault"
            type="password"
            autoComplete="new-password"
            error={errors.confirmVaultPassword?.message}
            {...register("confirmVaultPassword")}
          />

          {error && (
            <p className="text-xs text-red-600 font-mono">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loading} icon={FolderPlus}>
              Criar Projeto
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
