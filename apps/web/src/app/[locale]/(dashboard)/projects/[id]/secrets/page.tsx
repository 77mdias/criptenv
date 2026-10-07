import { SecretsClient } from "./secrets-client"

interface SecretsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SecretsPage({ params }: SecretsPageProps) {
  const { id } = await params

  return <SecretsClient projectId={id} />
}
