import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandProps {
  href?: string;
  className?: string;
  compact?: boolean;
  subtitle?: string;
}

function Brand({
  href = "/",
  className,
  compact = false,
  subtitle,
}: BrandProps) {
  const logoSizeClass = compact
    ? "h-[44px] w-auto sm:h-[52px] lg:h-[60px]"
    : "h-[72px] w-auto sm:h-[80px]";

  const content = (
    <div
      className={cn("flex flex-col", compact ? "gap-0" : "gap-2", className)}
    >
      <div className={cn("relative shrink-0", logoSizeClass)}>
        <Image
          src="/images/logocriptenv.png"
          alt="CriptEnv logo"
          width={500}
          height={500}
          priority={compact}
          className="h-full w-auto object-contain grayscale contrast-[1.8] brightness-[0.45] dark:invert dark:brightness-[1.8] dark:contrast-100"
        />
      </div>
      {subtitle ? (
        <span className="block text-xs uppercase tracking-[0.18em] text-(--text-tertiary)">
          {subtitle}
        </span>
      ) : null}
    </div>
  );

  return (
    <Link href={href} aria-label="CriptEnv home">
      {content}
    </Link>
  );
}

export { Brand };
