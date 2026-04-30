import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface BrandProps {
  href?: string
  className?: string
  compact?: boolean
  subtitle?: string
}

function Brand({
  href = "/",
  className,
  compact = false,
  subtitle,
}: BrandProps) {
  const logoSizeClass = compact
    ? "h-[48px] w-[148px] sm:h-[52px] sm:w-[160px]"
    : "h-[72px] w-[220px] sm:h-[80px] sm:w-[240px]"

  const content = (
    <div className={cn("flex flex-col", compact ? "gap-0" : "gap-2", className)}>
      <div className={cn("relative shrink-0", logoSizeClass)}>
        <Image
          src="/images/logocriptenv.png"
          alt="CriptEnv logo"
          width={500}
          height={500}
          priority={compact}
          className="h-full w-full object-contain grayscale contrast-[1.8] brightness-[0.45] dark:invert dark:brightness-[1.8] dark:contrast-100"
        />
      </div>
      {subtitle ? (
        <span className="block text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          {subtitle}
        </span>
      ) : null}
    </div>
  )

  return (
    <Link href={href} aria-label="CriptEnv home">
      {content}
    </Link>
  )
}

export { Brand }
