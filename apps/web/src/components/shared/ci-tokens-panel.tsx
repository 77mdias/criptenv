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
import { ciTokensApi, peekCached } from "@/lib/api";
import type { CIToken, CITokenListResponse, CITokenWithPlaintext } from "@/lib/api/client";

const AVAILABLE_SCOPES = [
  {
    value: "read:secrets",
    label: "Read Secrets",
    description: "Read secrets from environments",
  },
  {
    value: "write:secrets",
    label: "Write Secrets",
    description: "Create/update secrets",
  },
  {
    value: "delete:secrets",
    label: "Delete Secrets",
    description: "Delete secrets",
  },
  { value: "read:audit", label: "Read Audit", description: "Read audit logs" },
  {
    value: "write:integrations",
    label: "Manage Integrations",
    description: "Manage integrations",
  },
  {
    value: "admin:project",
    label: "Admin Project",
    description: "Full project access (dangerous)",
  },
];

interface CITokensPanelProps {
  projectId: string;
}

export function CITokensPanel({ projectId }: CITokensPanelProps) {
  const cachedTokens = peekCached<CITokenListResponse>(`/api/v1/projects/${projectId}/tokens`, {
    include_revoked: "true",
  });
  const [tokens, setTokens] = useState<CIToken[]>(cachedTokens?.tokens ?? []);
  const [loading, setLoading] = useState(!cachedTokens);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTokenResult, setNewTokenResult] =
    useState<CITokenWithPlaintext | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ciTokensApi.list(projectId, true);
      setTokens(data.tokens);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar tokens");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTokens();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTokens]);

  const handleCopyToken = async () => {
    if (!newTokenResult) return;
    try {
      await navigator.clipboard.writeText(newTokenResult.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = newTokenResult.token;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    try {
      setRevokingId(tokenId);
      await ciTokensApi.revoke(projectId, tokenId);
      await fetchTokens();
      setConfirmRevokeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao revogar token");
    } finally {
      setRevokingId(null);
    }
  };

  const handleTokenCreated = (result: CITokenWithPlaintext) => {
    setNewTokenResult(result);
    setShowCreateModal(false);
    fetchTokens();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isRevoked = (token: CIToken) => !!token.revoked_at;
  const isExpired = (token: CIToken) =>
    token.expires_at && new Date(token.expires_at) < new Date();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Token Revealed Modal */}
      {newTokenResult && (
        <Card className="p-6 border-green-500/50 bg-green-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Check className="h-5 w-5 text-green-500" />
            <h3 className="font-semibold text-green-500">
              Token criado com sucesso!
            </h3>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] font-mono mb-3">
            ⚠️ Copie este token agora. Ele não será exibido novamente.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-[var(--surface)] rounded-lg text-sm font-mono break-all border border-[var(--border)]">
              {newTokenResult.token}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyToken}
              icon={copiedToken ? Check : Copy}
            >
              {copiedToken ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewTokenResult(null)}
            >
              Fechar
            </Button>
          </div>
        </Card>
      )}

      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold text-[var(--text-primary)]">
              CI Tokens
            </h2>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            icon={Plus}
          >
            Novo Token
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/50 bg-red-500/5">
            <p className="text-red-500 text-sm font-mono">{error}</p>
          </div>
        )}

        {tokens.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
            <p className="text-[var(--text-tertiary)] font-mono text-sm">
              Nenhum CI token criado ainda.
            </p>
            <p className="text-[var(--text-muted)] font-mono text-xs mt-1">
              Crie tokens para integrar com CI/CD pipelines.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className={`p-4 rounded-lg border transition-colors ${
                  isRevoked(token)
                    ? "border-red-500/20 bg-red-500/5 opacity-60"
                    : isExpired(token)
                      ? "border-yellow-500/20 bg-yellow-500/5"
                      : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {token.name}
                      </span>
                      {isRevoked(token) && (
                        <Badge variant="danger">Revogado</Badge>
                      )}
                      {isExpired(token) && !isRevoked(token) && (
                        <Badge variant="warning">Expirado</Badge>
                      )}
                      {!isRevoked(token) && !isExpired(token) && (
                        <Badge variant="success">Ativo</Badge>
                      )}
                    </div>

                    {token.description && (
                      <p className="text-xs text-[var(--text-tertiary)] font-mono mb-2">
                        {token.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {token.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[var(--accent)]/10 text-[var(--accent)]"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] font-mono">
                      {token.environment_scope && (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {token.environment_scope}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Último uso: {formatDate(token.last_used_at)}
                      </span>
                      {token.expires_at && (
                        <span>Expira: {formatDate(token.expires_at)}</span>
                      )}
                      <span>Criado: {formatDate(token.created_at)}</span>
                    </div>
                  </div>

                  {!isRevoked(token) && (
                    <div className="flex items-center gap-2 ml-4">
                      {confirmRevokeId === token.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-500 font-mono mr-1">
                            Revogar?
                          </span>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRevoke(token.id)}
                            loading={revokingId === token.id}
                          >
                            Sim
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmRevokeId(null)}
                          >
                            Não
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRevokeId(token.id)}
                          icon={Trash2}
                          className="text-red-500 hover:text-red-600"
                        >
                          Revogar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Token Modal */}
      {showCreateModal && (
        <CreateTokenModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTokenCreated}
        />
      )}
    </div>
  );
}

// ─── Create Token Modal ──────────────────────────────────────────────────────

interface CreateTokenModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: (result: CITokenWithPlaintext) => void;
}

function CreateTokenModal({
  projectId,
  onClose,
  onCreated,
}: CreateTokenModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "read:secrets",
  ]);
  const [environmentScope, setEnvironmentScope] = useState("");
  const [expiresDays, setExpiresDays] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    if (selectedScopes.length === 0) {
      setError("Selecione pelo menos um scope");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const payload: {
        name: string;
        description?: string;
        scopes: string[];
        environment_scope?: string;
        expires_at?: string;
      } = {
        name: name.trim(),
        scopes: selectedScopes,
      };

      if (description.trim()) {
        payload.description = description.trim();
      }

      if (environmentScope.trim()) {
        payload.environment_scope = environmentScope.trim();
      }

      if (expiresDays && parseInt(expiresDays) > 0) {
        const expires = new Date();
        expires.setDate(expires.getDate() + parseInt(expiresDays));
        payload.expires_at = expires.toISOString();
      }

      const result = await ciTokensApi.create(projectId, payload);
      onCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar token");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-[var(--text-primary)]">
            Novo CI Token
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} icon={X} />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/50 bg-red-500/5">
            <p className="text-red-500 text-sm font-mono">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Nome *
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: GitHub Actions Deploy"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Descrição
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
            />
          </div>

          {/* Scopes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Scopes *
            </label>
            <div className="space-y-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedScopes.includes(scope.value)
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] hover:border-[var(--accent)]/50"
                  } ${scope.value === "admin:project" ? "border-red-500/30" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="mt-0.5 rounded border-[var(--border)]"
                  />
                  <div>
                    <span className="text-sm font-mono font-medium text-[var(--text-primary)]">
                      {scope.label}
                    </span>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      {scope.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Environment Scope */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Restrição de Ambiente
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              value={environmentScope}
              onChange={(e) =>
                setEnvironmentScope(
                  e.target.value.toLowerCase().replace(/\s+/g, "-"),
                )
              }
              placeholder="ex: production (vazio = todos)"
            />
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Deixe vazio para permitir acesso a todos os ambientes.
            </p>
          </div>

          {/* Expiration */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Expiração (dias)
            </label>
            <input
              type="number"
              min="1"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              placeholder="Vazio = sem expiração"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} loading={creating}>
            Criar Token
          </Button>
        </div>
      </Card>
    </div>
  );
}
