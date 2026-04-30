"use client"

import { Settings } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
          Conecte serviços externos ao seu workspace
        </p>
      </div>

      <EmptyState
        icon={Settings}
        title="Em desenvolvimento"
        description="As integrações com serviços externos estarão disponíveis em breve."
      />
    </div>
  )
}
