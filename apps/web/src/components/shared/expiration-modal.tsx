"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";

interface ExpirationModalProps {
  secretKey: string;
  hasExpiration: boolean;
  onClose: () => void;
  onSave: (days: number, policy: string, notifyDays: number) => void;
  onDelete: () => void;
}

export function ExpirationModal({
  secretKey,
  hasExpiration,
  onClose,
  onSave,
  onDelete,
}: ExpirationModalProps) {
  const t = useTranslations("secrets.expiration");
  const [days, setDays] = useState("30");
  const [policy, setPolicy] = useState("notify");
  const [notifyDays, setNotifyDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[var(--accent)]" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("secretLabel")}{" "}
            <span className="font-semibold text-[var(--text-primary)]">{secretKey}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
              {t("expiresInDays")}
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
              {t("rotationPolicy")}
            </label>
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm font-mono"
            >
              <option value="manual">{t("policies.manual")}</option>
              <option value="notify">{t("policies.notify")}</option>
              <option value="auto">{t("policies.auto")}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
              {t("notifyBefore")}
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

        <DialogFooter className="justify-start">
          <Button onClick={handleSave} loading={loading}>
            {t("save")}
          </Button>
          {hasExpiration && (
            <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)} loading={loading}>
              {t("remove")}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={confirmDeleteOpen}
        title={t("removeConfirmTitle")}
        description={t("removeConfirmDescription", { key: secretKey })}
        confirmLabel={t("confirmRemove")}
        destructive
        loading={loading}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDelete}
      />
    </>
  );
}
