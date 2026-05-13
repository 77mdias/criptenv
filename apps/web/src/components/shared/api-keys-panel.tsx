"use client";

import { useEffect, useState, useCallback } from "react";
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

const AVAILABLE_SCOPES = [
  { value: "read:secrets", label: "Read Secrets", description: "Read secrets from environments" },
  { value: "write:secrets", label: "Write Secrets", description: "Create/update secrets" },
  { value: "delete:secrets", label: "Delete Secrets", description: "Delete secrets" },
  { value: "read:audit", label: "Read Audit", description: "Read audit logs" },
  { value: "write:integrations", label: "Manage Integrations", description: "Manage integrations" },
  { value: "admin:project", label: "Admin Project", description: "Full project access (dangerous)" },
];

interface ApiKeysPanelProps {
  projectId: string;
}

export function ApiKeysPanel({ projectId }: ApiKeysPanelProps) {
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
      setError(err instanceof Error ? err.message : "Erro ao carregar API keys");
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
      setError(err instanceof Error ? err.message : "Erro ao criar API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm("Revogar esta API key? Aplicações que a utilizam pararão de funcionar.")) return;
    try {
      await apiKeysApi.revoke(projectId, keyId);
      void fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao revogar");
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
          <h3 className="font-semibold text-[var(--text-primary)]">API Keys</h3>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova API Key
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm font-mono">{error}</p>}

      {/* Created key display (one-time) */}
      {createdKey && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
          <p className="text-sm font-semibold text-green-600">API Key criada — copie agora, não será exibida novamente!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-[var(--background)] rounded font-mono text-xs break-all">{createdKey.key}</code>
            <Button size="sm" variant="secondary" onClick={() => copyKey(createdKey.key)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="p-4 border border-[var(--border)] rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">Nome</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Ex: produção-ci"
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">Scopes</label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes(scope.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewKeyScopes([...newKeyScopes, scope.value]);
                      } else {
                        setNewKeyScopes(newKeyScopes.filter((s) => s !== scope.value));
                      }
                    }}
                  />
                  <span className="text-[var(--text-secondary)]">{scope.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">Environment restriction (opcional)</label>
            <input
              type="text"
              value={newKeyEnv}
              onChange={(e) => setNewKeyEnv(e.target.value)}
              placeholder="production"
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">Expira em (dias, opcional)</label>
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
            <Button size="sm" onClick={handleCreate} loading={creating}>Criar</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] font-mono">Nenhuma API key criada.</p>
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
                  {key.last_used_at && <span>Usada: {new Date(key.last_used_at).toLocaleDateString("pt-BR")}</span>}
                  {key.expires_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expira: {new Date(key.expires_at).toLocaleDateString("pt-BR")}
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
