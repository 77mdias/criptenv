import { MarketingSidebar } from "@/components/layout/marketing-sidebar"
import { MarketingHeader } from "@/components/layout/marketing-header"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <MarketingSidebar />
      {children}
    </div>
  )
}
