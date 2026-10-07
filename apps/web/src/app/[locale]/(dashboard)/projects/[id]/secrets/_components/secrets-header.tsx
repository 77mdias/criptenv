import { useTranslations } from "next-intl";
import { Download, Plus, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SecretsHeaderProps {
  activeEnvName: string;
  activeSecretCount: number;
  vaultVersion: number;
  isProjectUnlocked: boolean;
  onImport: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onCreate: () => void;
}

export function SecretsHeader({
  activeEnvName,
  activeSecretCount,
  vaultVersion,
  isProjectUnlocked,
  onImport,
  onExport,
  onRefresh,
  onCreate,
}: SecretsHeaderProps) {
  const t = useTranslations("secrets.header");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 font-mono text-sm text-(--text-tertiary)">
          {activeEnvName} · {activeSecretCount} secrets · vault v{vaultVersion}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {isProjectUnlocked && (
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={Upload}
              onClick={onImport}
            >
              {t("import")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={onExport}
            >
              {t("export")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={onRefresh}
            >
              {t("refresh")}
            </Button>
            <Button size="sm" icon={Plus} onClick={onCreate}>
              {t("newSecret")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
