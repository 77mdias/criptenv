"use client"

import { useEffect, useMemo, useState } from "react"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { EnvSelector } from "@/components/shared/env-selector"
import { ExportModal } from "@/components/shared/export-modal"
import { ImportModal } from "@/components/shared/import-modal"
import { PermissionDialog } from "@/components/shared/permission-dialog"
import { SecretForm } from "@/components/shared/secret-form"
import { ExpirationModal } from "@/components/shared/expiration-modal"
import { VaultUnlockPanel } from "@/components/shared/vault-unlock-panel"
import type { DecryptedSecret } from "@/components/shared/secret-row"
import { canWriteProjectSecrets } from "@/lib/project-permissions"
import { SecretsEmptyState } from "./_components/secrets-empty-state"
import { SecretsErrorBanner } from "./_components/secrets-error-banner"
import { SecretsHeader } from "./_components/secrets-header"
import { SecretsLoadingState } from "./_components/secrets-loading-state"
import { UnlockedVaultPanel } from "./_components/unlocked-vault-panel"
import { useProjectSecrets } from "./use-project-secrets"

interface SecretsClientProps {
  projectId: string
}

export function SecretsClient({ projectId }: SecretsClientProps) {
  const { state, actions } = useProjectSecrets(projectId)
  const canManageSecrets = canWriteProjectSecrets(state.project?.current_user_role)
  const [permissionOpen, setPermissionOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DecryptedSecret | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selection, setSelection] = useState<{ environmentId: string | null; keys: string[] }>({
    environmentId: null,
    keys: [],
  })
  const [rotateTarget, setRotateTarget] = useState<DecryptedSecret | null>(null)

  const showPermission = () => setPermissionOpen(true)
  const guardedCreate = () => {
    if (!canManageSecrets) {
      showPermission()
      return
    }
    actions.openCreateForm()
  }
  const guardedImport = () => {
    if (!canManageSecrets) {
      showPermission()
      return
    }
    actions.setImportOpen(true)
  }

  const selectedSecretKeys = useMemo(() => {
    if (!canManageSecrets || !state.isProjectUnlocked || selection.environmentId !== state.activeEnv?.id) {
      return []
    }

    const visibleKeys = new Set(state.secretsWithExpiration.map((secret) => secret.key))
    return selection.keys.filter((key) => visibleKeys.has(key))
  }, [canManageSecrets, selection, state.activeEnv?.id, state.isProjectUnlocked, state.secretsWithExpiration])

  const selectedSecrets = useMemo(() => {
    const selectedSet = new Set(selectedSecretKeys)
    return state.secretsWithExpiration.filter((secret) => selectedSet.has(secret.key))
  }, [selectedSecretKeys, state.secretsWithExpiration])

  const clearSelection = () => setSelection({ environmentId: null, keys: [] })

  const handleSelectSecret = (secret: DecryptedSecret, selected: boolean) => {
    if (!canManageSecrets) return
    setSelection((current) => {
      const currentKeys = current.environmentId === state.activeEnv?.id ? current.keys : []
      if (selected) {
        return {
          environmentId: state.activeEnv?.id ?? null,
          keys: currentKeys.includes(secret.key) ? currentKeys : [...currentKeys, secret.key],
        }
      }
      return {
        environmentId: state.activeEnv?.id ?? null,
        keys: currentKeys.filter((key) => key !== secret.key),
      }
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (!canManageSecrets) return
    setSelection({
      environmentId: state.activeEnv?.id ?? null,
      keys: selected ? state.secretsWithExpiration.map((secret) => secret.key) : [],
    })
  }

  const guardedBulkDelete = () => {
    if (!canManageSecrets) {
      showPermission()
      return
    }
    if (selectedSecretKeys.length === 0) return
    setBulkDeleteOpen(true)
  }

  useEffect(() => {
    const openNewSecret = () => {
      if (!canManageSecrets) {
        showPermission()
        return
      }
      actions.openCreateForm()
    }

    window.addEventListener("criptenv:new-secret", openNewSecret)
    return () => window.removeEventListener("criptenv:new-secret", openNewSecret)
  }, [actions, canManageSecrets])

  if (state.loading) {
    return <SecretsLoadingState />
  }

  if (state.environments.length === 0) {
    return <SecretsEmptyState />
  }

  return (
    <div className="space-y-6">
      <SecretsHeader
        activeEnvName={state.activeEnvName}
        activeSecretCount={state.activeSecretCount}
        vaultVersion={state.vaultVersion}
        isProjectUnlocked={state.isProjectUnlocked}
        onImport={guardedImport}
        onExport={() => actions.setExportOpen(true)}
        onRefresh={actions.refreshVault}
        onCreate={guardedCreate}
      />

      {state.error && <SecretsErrorBanner message={state.error} />}

      <EnvSelector
        environments={state.environments}
        activeEnvironmentId={state.activeEnv?.id ?? null}
        secretCounts={state.secretCounts}
        onSelect={actions.setActiveEnv}
      />

      {!state.isProjectUnlocked ? (
        <VaultUnlockPanel
          vaultConfig={state.project?.vault_config}
          onUnlock={actions.unlockVault}
        />
      ) : (
        <UnlockedVaultPanel
          secrets={state.secretsWithExpiration}
          environmentName={state.activeEnvName}
          copiedKey={state.copiedKey}
          busy={state.vaultLoading || state.saving}
          canManageSecrets={canManageSecrets}
          selectedKeys={selectedSecretKeys}
          onSelectChange={handleSelectSecret}
          onSelectAllChange={handleSelectAll}
          onClearSelection={clearSelection}
          onBulkDelete={guardedBulkDelete}
          onCopy={actions.copySecret}
          onEdit={actions.openEditForm}
          onDelete={setDeleteTarget}
          onCreate={guardedCreate}
          onRotate={setRotateTarget}
          onSetExpiration={actions.openExpirationModal}
          onLock={actions.lockVault}
        />
      )}

      <SecretForm
        open={state.formOpen}
        title={state.editingSecret ? "Editar Secret" : "Novo Secret"}
        initialValue={state.editingSecret}
        loading={state.saving}
        onOpenChange={actions.setFormOpen}
        onSubmit={actions.saveSecret}
      />
      {state.expirationModalOpen && state.expirationSecret && (
        <ExpirationModal
          secretKey={state.expirationSecret.key}
          hasExpiration={Boolean(state.expirationSecret.expiresAt)}
          onClose={actions.closeExpirationModal}
          onSave={actions.saveExpiration}
          onDelete={actions.deleteExpiration}
        />
      )}
      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        title="Remover secret"
        description={
          deleteTarget
            ? `Remover ${deleteTarget.key} deste ambiente? Esta ação atualizará o vault criptografado.`
            : ""
        }
        confirmLabel="Remover"
        destructive
        loading={state.saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (!deleteTarget) return
          await actions.deleteSecret(deleteTarget)
          setDeleteTarget(null)
        }}
      />
      <ConfirmActionDialog
        open={bulkDeleteOpen}
        title="Excluir secrets selecionadas"
        description={
          selectedSecrets.length > 0
            ? `Excluir ${selectedSecrets.length} secrets do ambiente ${state.activeEnvName}? Esta ação atualizará o vault criptografado e não poderá ser desfeita.`
            : ""
        }
        confirmLabel={`Excluir ${selectedSecrets.length} secrets`}
        destructive
        loading={state.saving}
        onOpenChange={(open) => setBulkDeleteOpen(open)}
        onConfirm={async () => {
          const keysToDelete = selectedSecrets.map((secret) => secret.key)
          if (keysToDelete.length === 0) return
          await actions.deleteSecrets(keysToDelete)
          clearSelection()
          setBulkDeleteOpen(false)
        }}
      />
      <ConfirmActionDialog
        open={Boolean(rotateTarget)}
        title="Rotacionar secret"
        description={
          rotateTarget
            ? `Rotacionar ${rotateTarget.key}? Um novo valor aleatório será gerado e salvo no vault.`
            : ""
        }
        confirmLabel="Rotacionar"
        loading={state.saving}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null)
        }}
        onConfirm={async () => {
          if (!rotateTarget) return
          await actions.rotateSecret(rotateTarget)
          setRotateTarget(null)
        }}
      />
      <PermissionDialog open={permissionOpen} onOpenChange={setPermissionOpen} />
      <ImportModal
        open={state.importOpen}
        onOpenChange={actions.setImportOpen}
        onImport={actions.importSecrets}
      />
      <ExportModal
        open={state.exportOpen}
        onOpenChange={actions.setExportOpen}
        secrets={state.secrets}
      />
    </div>
  )
}
