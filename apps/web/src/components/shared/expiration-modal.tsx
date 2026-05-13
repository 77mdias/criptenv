"use client";

import { useState } from "react";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExpirationModalProps {
  secretKey: string;
  onClose: () => void;
  onSave: (days: number, policy: string, notifyDays: number) => void;
  onDelete: () => void;
  hasExpiration: boolean;
}

export function ExpirationModal({
  secretKey,
  onClose,
  onSave,
  onDelete,
  hasExpiration,
}: ExpirationModalProps) {
  const [days, setDays] = useState("30");
  const [policy, setPolicy] = useState("notify");
  const [notifyDays, setNotifyDays] = useState("7");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const d = parseInt(days);
    if (isNaN(d) || d < 1) return;
    setLoading(true);
    try {
      await onSave(d, policy, parseInt(notifyDays) || 7);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Remover configuração de expiração deste secret?")) return;
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Expiração de Secret</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-[var(--text-tertiary)] font-mono mb-4">
          Secret: <span className="font-semibold text-[var(--text-primary)]">{secretKey}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
              Expira em (dias)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
              Política de rotação
            </label>
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            >
              <option value="manual">Manual — apenas notificar</option>
              <option value="notify">Notificar antes de expirar</option>
              <option value="auto">Auto-rotacionar ao expirar</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
              Notificar antes (dias)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={notifyDays}
              onChange={(e) => setNotifyDays(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} loading={loading}>
            Salvar
          </Button>
          {hasExpiration && (
            <Button variant="danger" onClick={handleDelete} loading={loading}>
              Remover expiração
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
