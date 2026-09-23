import { Lock } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"

export function SecretsEmptyState() {
  return (
    <EmptyState
      icon={Lock}
      title="Nenhum ambiente encontrado"
      description="Crie um ambiente para este projeto para começar a armazenar secrets."
    />
  )
}
