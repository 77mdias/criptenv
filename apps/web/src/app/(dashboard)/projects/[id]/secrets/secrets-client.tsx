"use client"

import { EnvSelector } from "@/components/shared/env-selector"
import { ExportModal } from "@/components/shared/export-modal"
import { ImportModal } from "@/components/shared/import-modal"
import { SecretForm } from "@/components/shared/secret-form"
import { ExpirationModal } from "@/components/shared/expiration-modal"
import { VaultUnlockPanel } from "@/components/shared/vault-unlock-panel"
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
        onImport={() => actions.setImportOpen(true)}
        onExport={() => actions.setExportOpen(true)}
        onRefresh={actions.refreshVault}
        onCreate={actions.openCreateForm}
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
          onCopy={actions.copySecret}
          onEdit={actions.openEditForm}
          onDelete={actions.deleteSecret}
          onCreate={actions.openCreateForm}
          onRotate={actions.rotateSecret}
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
