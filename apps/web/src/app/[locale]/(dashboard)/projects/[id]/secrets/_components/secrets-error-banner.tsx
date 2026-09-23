import { Card } from "@/components/ui/card"

interface SecretsErrorBannerProps {
  message: string
}

export function SecretsErrorBanner({ message }: SecretsErrorBannerProps) {
  return (
    <Card className="border-red-500/50 p-4">
      <p className="font-mono text-sm text-red-600">{message}</p>
    </Card>
  )
}
