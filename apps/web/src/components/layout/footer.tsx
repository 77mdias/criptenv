import Link from "next/link"
import { Brand } from "@/components/layout/brand"
import { StatusBadge } from "@/components/ui/status-badge"

function Footer() {
  return (
    <footer className="bg-[var(--background)] border-t border-[var(--border)] px-6 sm:px-8">
      <div className="mx-auto max-w-6xl py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 justify-between items-center">
          <div>
            <Brand subtitle="Secret Management for Developers" />
          </div>
          <div className="flex flex-col md:flex-row gap-6 md:justify-end items-start md:items-center text-sm font-medium text-[var(--text-secondary)]">
            <StatusBadge status="online" label="All systems operational" />
            <nav className="flex gap-6">
              <Link href="/docs" prefetch={false} className="hover:text-[var(--text-primary)] transition">
                Docs
              </Link>
              <Link href="https://github.com/criptenv" className="hover:text-[var(--text-primary)] transition">
                GitHub
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}

export { Footer }
