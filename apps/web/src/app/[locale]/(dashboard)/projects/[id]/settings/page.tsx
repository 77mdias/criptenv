"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Settings, Trash2, AlertTriangle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionDialog } from "@/components/shared/permission-dialog";
import { environmentsApi, peekCached, projectsApi, vaultApi } from "@/lib/api";
import { CITokensPanel } from "@/components/shared/ci-tokens-panel";
import { ApiKeysPanel } from "@/components/shared/api-keys-panel";
import { ProjectAlertSettings } from "@/components/shared/project-alert-settings";
import { canManageProject } from "@/lib/project-permissions";
import {
  buildProjectVaultConfig,
  checksum,
  decrypt,
  deriveSessionKeyFromBase64Salt,
  deriveProjectEnvironmentKey,
  encrypt,
  unlockProjectVault,
} from "@/lib/crypto";
import { useAuthStore } from "@/stores/auth";
import type { Project, VaultBlob, VaultBlobPush } from "@/lib/api";

async function decryptVaultBlobs(blobs: VaultBlob[], key: CryptoKey) {
  return Promise.all(
    blobs.map(async (blob) => ({
      key: blob.key_id,
      value: await decrypt(blob.ciphertext, key, blob.iv, blob.auth_tag),
    })),
  );
}

async function encryptVaultSecrets(
  secrets: Array<{ key: string; value: string }>,
  key: CryptoKey,
  version: number,
): Promise<VaultBlobPush[]> {
  return Promise.all(
    secrets.map(async (secret) => {
      const encrypted = await encrypt(secret.value, key);
      const digest = await checksum(
        `${secret.key}:${encrypted.iv}:${encrypted.ciphertext}:${encrypted.authTag}`,
      );

      return {
        key_id: secret.key,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        auth_tag: encrypted.authTag,
        checksum: digest,
        version,
      };
    }),
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const cachedProject = peekCached<Project>(`/api/v1/projects/${projectId}`);
  const user = useAuthStore((state) => state.user);

  const [project, setProject] = useState<Project | null>(cachedProject);
  const [loading, setLoading] = useState(!cachedProject);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(cachedProject?.name ?? "");
  const [description, setDescription] = useState(
    cachedProject?.description ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [rekeying, setRekeying] = useState(false);
  const [currentVaultPassword, setCurrentVaultPassword] = useState("");
  const [newVaultPassword, setNewVaultPassword] = useState("");
  const [confirmNewVaultPassword, setConfirmNewVaultPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchProject() {
      try {
        const data = await projectsApi.get(projectId);
        if (cancelled) return;
        setProject(data);
        setName(data.name);
        setDescription(data.description || "");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("general.loadError"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await projectsApi.update(projectId, {
        name,
        description: description || undefined,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("general.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== project?.name) return;
    try {
      setDeleting(true);
      await projectsApi.delete(projectId);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("general.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  const buildRekeyPayload = async (
    currentKeyForEnvironment: (environmentId: string) => Promise<CryptoKey>,
    newPassword: string,
  ) => {
    const { vaultConfig: newVaultConfig, vaultProof: newVaultProof } =
      await buildProjectVaultConfig(newPassword);
    const newMaterial = await unlockProjectVault(newPassword, newVaultConfig);
    const envData = await environmentsApi.list(projectId);

    const environments = await Promise.all(
      envData.environments.map(async (environment) => {
        const vault = await vaultApi.pull(projectId, environment.id);
        const currentEnvKey = await currentKeyForEnvironment(environment.id);
        const newEnvKey = await deriveProjectEnvironmentKey(
          newMaterial.keyMaterial,
          environment.id,
        );
        const secrets = await decryptVaultBlobs(vault.blobs, currentEnvKey);

        return {
          environment_id: environment.id,
          blobs: await encryptVaultSecrets(
            secrets,
            newEnvKey,
            vault.version + 1,
          ),
        };
      }),
    );

    return { newVaultConfig, newVaultProof, environments };
  };

  const handleRekey = async () => {
    if (newVaultPassword.length < 8) {
      setError(t("general.rekey.minLength"));
      return;
    }
    if (newVaultPassword !== confirmNewVaultPassword) {
      setError(t("general.rekey.mismatch"));
      return;
    }

    try {
      setRekeying(true);
      setError(null);

      let currentVaultProof = "legacy-migration";
      let currentKeyForEnvironment: (
        environmentId: string,
      ) => Promise<CryptoKey>;

      if (project?.vault_config) {
        const currentMaterial = await unlockProjectVault(
          currentVaultPassword,
          project.vault_config,
        );
        currentVaultProof = currentMaterial.vaultProof;
        currentKeyForEnvironment = (environmentId) =>
          deriveProjectEnvironmentKey(
            currentMaterial.keyMaterial,
            environmentId,
          );
      } else {
        if (!user?.kdf_salt) {
          throw new Error(t("general.rekey.noKdfSalt"));
        }
        const legacyKey = await deriveSessionKeyFromBase64Salt(
          currentVaultPassword,
          user.kdf_salt,
        );
        currentKeyForEnvironment = async () => legacyKey;
      }

      const { newVaultConfig, newVaultProof, environments } =
        await buildRekeyPayload(currentKeyForEnvironment, newVaultPassword);

      const updated = await projectsApi.rekeyVault(projectId, {
        current_vault_proof: currentVaultProof,
        new_vault_config: newVaultConfig,
        new_vault_proof: newVaultProof,
        environments,
      });

      setProject(updated);
      setCurrentVaultPassword("");
      setNewVaultPassword("");
      setConfirmNewVaultPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("general.rekey.error"),
      );
    } finally {
      setRekeying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("general.title")}
          </h1>
          <p className="text-(--text-tertiary) text-sm font-mono mt-1">
            {t("general.subtitle")}
          </p>
        </div>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </Card>
      </div>
    );
  }

  if (!canManageProject(project?.current_user_role)) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold tracking-tight text-(--text-primary)">
            {t("general.restricted.title")}
          </h1>
          <p className="mt-2 font-mono text-sm leading-relaxed text-(--text-tertiary)">
            {t("general.restricted.description")}
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => router.push(`/projects/${projectId}`)}>
            {t("general.restricted.back")}
          </Button>
        </Card>
        <PermissionDialog
          open={permissionOpen}
          onOpenChange={setPermissionOpen}
          actionLabel={t("general.restricted.back")}
          onAction={() => router.push(`/projects/${projectId}`)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("general.title")}</h1>
        <p className="text-(--text-tertiary) text-sm font-mono mt-1">
          {t("general.subtitle")}
        </p>
      </div>

      {/* CI Tokens */}
      <CITokensPanel projectId={projectId} />

      {/* API Keys */}
      <ApiKeysPanel projectId={projectId} />

      {/* Alert Settings */}
      <ProjectAlertSettings projectId={projectId} />

      {error && (
        <Card className="p-4 border-red-500/50">
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </Card>
      )}

      {/* General Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5 text-(--text-muted)" />
          <h2 className="font-semibold text-(--text-primary)">
            {t("general.info.title")}
          </h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-(--text-muted) uppercase tracking-wider font-mono">
              {t("general.info.name")}
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-(--text-muted) uppercase tracking-wider font-mono">
              {t("general.info.description")}
            </label>
            <textarea
              className="flex w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-2 min-h-25 resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("general.info.descriptionPlaceholder")}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              {t("general.info.save")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="h-5 w-5 text-(--text-muted)" />
          <h2 className="font-semibold text-(--text-primary)">
            {t("general.vault.title")}
          </h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-(--text-muted) uppercase tracking-wider font-mono">
              {project?.vault_config ? t("general.vault.current") : t("general.vault.legacy")}
            </label>
            <input
              type="password"
              className="flex h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-2"
              value={currentVaultPassword}
              onChange={(event) => setCurrentVaultPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-(--text-muted) uppercase tracking-wider font-mono">
              {t("general.vault.newPassword")}
            </label>
            <input
              type="password"
              className="flex h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-2"
              value={newVaultPassword}
              onChange={(event) => setNewVaultPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-(--text-muted) uppercase tracking-wider font-mono">
              {t("general.vault.confirmPassword")}
            </label>
            <input
              type="password"
              className="flex h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-2"
              value={confirmNewVaultPassword}
              onChange={(event) =>
                setConfirmNewVaultPassword(event.target.value)
              }
              autoComplete="new-password"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleRekey}
              loading={rekeying}
              disabled={
                !currentVaultPassword ||
                !newVaultPassword ||
                !confirmNewVaultPassword
              }
            >
              {project?.vault_config
                ? t("general.vault.rekey")
                : t("general.vault.migrate")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-red-500/30">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="font-semibold text-red-500">{t("general.danger.title")}</h2>
        </div>

        <p className="text-sm text-(--text-tertiary) font-mono mb-4">
          {t("general.danger.description")}
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-(--text-muted) uppercase tracking-wider font-mono">
              {t.rich("general.danger.confirmLabel", {
                name: project?.name ?? "",
                red: (chunks) => (
                  <span className="text-red-500">{chunks}</span>
                ),
              })}
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={project?.name}
            />
          </div>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
            disabled={deleteConfirm !== project?.name}
            icon={Trash2}
          >
            {t("general.danger.delete")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
