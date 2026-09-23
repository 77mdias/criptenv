import { KeyRound } from "lucide-react";
import { SecretsTable } from "@/components/shared/secrets-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DecryptedSecret } from "@/components/shared/secret-row";

interface UnlockedVaultPanelProps {
  secrets: DecryptedSecret[];
  environmentName: string;
  copiedKey: string | null;
  busy: boolean;
  canManageSecrets: boolean;
  selectedKeys?: string[];
  onSelectChange?: (secret: DecryptedSecret, selected: boolean) => void;
  onSelectAllChange?: (selected: boolean) => void;
  onClearSelection?: () => void;
  onBulkDelete?: () => void;
  onCopy: (secret: DecryptedSecret) => void;
  onEdit: (secret: DecryptedSecret) => void;
  onDelete: (secret: DecryptedSecret) => void;
  onCreate: () => void;
  onRotate: (secret: DecryptedSecret) => void;
  onSetExpiration: (secret: DecryptedSecret) => void;
  onLock: () => void;
}

export function UnlockedVaultPanel({
  secrets,
  environmentName,
  copiedKey,
  busy,
  canManageSecrets,
  selectedKeys,
  onSelectChange,
  onSelectAllChange,
  onClearSelection,
  onBulkDelete,
  onCopy,
  onEdit,
  onDelete,
  onCreate,
  onRotate,
  onSetExpiration,
  onLock,
}: UnlockedVaultPanelProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-(--border) px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-xs text-(--text-muted)">
          <KeyRound className="h-3.5 w-3.5" />
          Vault desbloqueado apenas nesta sessão
        </div>
        <Button variant="ghost" size="sm" onClick={onLock}>
          Bloquear
        </Button>
      </div>
      {busy ? (
        <div className="space-y-0">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="border-b border-(--border) px-6 py-4 last:border-0"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
          ))}
        </div>
      ) : (
        <SecretsTable
          secrets={secrets}
          environmentName={environmentName}
          copiedKey={copiedKey}
          canManageSecrets={canManageSecrets}
          selectedKeys={selectedKeys}
          onSelectChange={onSelectChange}
          onSelectAllChange={onSelectAllChange}
          onClearSelection={onClearSelection}
          onBulkDelete={onBulkDelete}
          onCopy={onCopy}
          onEdit={onEdit}
          onDelete={onDelete}
          onCreate={onCreate}
          onRotate={onRotate}
          onSetExpiration={onSetExpiration}
        />
      )}
    </Card>
  );
}
