import { useTranslations } from "next-intl"
import { Lock } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"

export function SecretsEmptyState() {
  const t = useTranslations("secrets.emptyEnv")

  return (
    <EmptyState
      icon={Lock}
      title={t("title")}
      description={t("description")}
    />
  )
}
