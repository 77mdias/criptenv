import { MarketingHeader } from "@/components/layout/marketing-header";
import { FloatingBar } from "@/components/floating-bar/floating-bar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-(--background) text-(--text-primary) overflow-x-hidden">
      <MarketingHeader />
      <FloatingBar />
      {children}
    </div>
  );
}
