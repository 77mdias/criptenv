import { Brand } from "@/components/layout/brand"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background-subtle)] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Brand subtitle="Zero-Knowledge Secrets" />
        </div>
        {children}
      </div>
    </div>
  )
}
