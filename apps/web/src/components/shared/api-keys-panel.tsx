"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Shield,
  Clock,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiKeysApi } from "@/lib/api";
import type { APIKey, APIKeyCreateResponse } from "@/lib/api/client";

// Keys, not copy: this is module scope, so no hook can run here.
const AVAILABLE_SCOPES = [
  { value: "read:secrets", key: "readSecrets", enabled: true },
  { value: "write:secrets", key: "writeSecrets", enabled: false },
  { value: "delete:secrets", key: "deleteSecrets", enabled: false },
  { value: "read:audit", key: "readAudit", enabled: false },
  { value: "write:integrations", key: "writeIntegrations", enabled: false },
  { value: "admin:project", key: "adminProject", enabled: false },
] as const;

interface ApiKeysPanelProps {
  projectId: string;
}

export function ApiKeysPanel({ projectId }: ApiKeysPanelProps) {
  const t = useTranslations("settings.apiKeys");
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read:secrets"]);
  const [newKeyEnv, setNewKeyEnv] = useState("");
  const [newKeyExpiresDays, setNewKeyExpiresDays] = useState("");
  const [createdKey, setCreatedKey] = useState<APIKeyCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await apiKeysApi.list(projectId);
      setKeys(resp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchKeys();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      setCreating(true);
      setError(null);
      const resp = await apiKeysApi.create(projectId, {
        name: newKeyName,
        scopes: newKeyScopes,
        environment_scope: newKeyEnv || undefined,
        expires_in_days: newKeyExpiresDays ? parseInt(newKeyExpiresDays) : undefined,
      });
      setCreatedKey(resp);
      setShowCreate(false);
      setNewKeyName("");
      setNewKeyScopes(["read:secrets"]);
      setNewKeyEnv("");
      setNewKeyExpiresDays("");
      void fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createError"));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm(t("revokeConfirm"))) return;
    try {
      await apiKeysApi.revoke(projectId, keyId);
      void fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("revokeError"));
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">{t("title")}</h3>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> {t("newKey")}
        </Button>
      </div>
      <p className="text-xs text-[var(--text-muted)] font-mono">
        {t("description")}
      </p>

      {error && <p className="text-red-500 text-sm font-mono">{error}</p>}

      {/* Created key display (one-time) */}
      {createdKey && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
          <p className="text-sm font-semibold text-green-600">{t("createdNotice")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-[var(--background)] rounded font-mono text-xs break-all">{createdKey.key}</code>
            <Button size="sm" variant="secondary" onClick={() => copyKey(createdKey.key)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)}>
            <X className="h-4 w-4 mr-1" /> {t("close")}
          </Button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="p-4 border border-[var(--border)] rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">{t("form.name")}</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("form.namePlaceholder")}
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">{t("form.scopes")}</label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope.value} className={`flex items-center gap-2 text-sm ${scope.enabled ? "" : "opacity-50"}`}>
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes(scope.value)}
                    disabled={!scope.enabled}
                    onChange={(e) => {
                      if (!scope.enabled) return;
                      if (e.target.checked) {
                        setNewKeyScopes([...newKeyScopes, scope.value]);
                      } else {
                        setNewKeyScopes(newKeyScopes.filter((s) => s !== scope.value));
                      }
                    }}
                  />
                  <span className="text-[var(--text-secondary)]">
                    {t(`scopes.${scope.key}.label`)}
                    {!scope.enabled && ` ${t("comingSoon")}`}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">{t("form.envRestriction")}</label>
            <input
              type="text"
              value={newKeyEnv}
              onChange={(e) => setNewKeyEnv(e.target.value)}
              placeholder="production"
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">{t("form.expiresIn")}</label>
            <input
              type="number"
              value={newKeyExpiresDays}
              onChange={(e) => setNewKeyExpiresDays(e.target.value)}
              placeholder="30"
              min={1}
              max={365}
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} loading={creating}>{t("form.create")}</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>{t("form.cancel")}</Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] font-mono">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--background-subtle)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--accent)]" />
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{key.name}</p>
                  <Badge variant="outline" className="text-[10px]">{key.prefix}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {key.scopes.map((s) => (
                    <Badge key={s} variant="default" className="text-[10px]">{s}</Badge>
                  ))}
                  {key.environment_scope && (
                    <Badge variant="outline" className="text-[10px]">env: {key.environment_scope}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] font-mono">
                  {key.last_used_at && <span>{t("lastUsed", { date: new Date(key.last_used_at).toLocaleDateString("pt-BR") })}</span>}
                  {key.expires_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("expires", {
                        date: new Date(key.expires_at).toLocaleDateString("pt-BR"),
                      })}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleRevoke(key.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
