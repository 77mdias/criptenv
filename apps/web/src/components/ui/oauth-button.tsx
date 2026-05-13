"use client"

import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGithubAlt, faGoogle, faDiscord } from "@fortawesome/free-brands-svg-icons"
import { Button, type ButtonProps } from "@/components/ui/button"
import { buildApiUrl } from "@/lib/api/base-url"
import { cn } from "@/lib/utils"

// OAuth provider configuration
const OAUTH_PROVIDERS = {
  github: {
    name: "GitHub",
    icon: faGithubAlt,
    color: "hover:border-[#24292e] hover:bg-[#24292e] hover:text-white",
  },
  google: {
    name: "Google",
    icon: faGoogle,
    color: "hover:border-[#4285f4] hover:bg-[#4285f4] hover:text-white",
  },
  discord: {
    name: "Discord",
    icon: faDiscord,
    color: "hover:border-[#5865F2] hover:bg-[#5865F2] hover:text-white",
  },
} as const

export type OAuthProvider = keyof typeof OAUTH_PROVIDERS

interface OAuthButtonProps extends Omit<ButtonProps, "variant" | "children"> {
  provider: OAuthProvider
  onClick?: () => void
  redirectUri?: string
}

export function OAuthButton({
  provider,
  className,
  disabled,
  loading,
  ...props
}: OAuthButtonProps) {
  const providerConfig = OAUTH_PROVIDERS[provider]

  const handleClick = () => {
    if (disabled || loading) return
    
    // Redirect to backend OAuth initiation endpoint
    window.location.href = buildApiUrl(`/api/auth/oauth/${provider}`)
  }

  return (
    <Button
      variant="secondary"
      className={cn(
        "h-11 min-w-0 gap-1.5 px-2 text-[11px] transition-all duration-200 sm:gap-2 sm:px-3 sm:text-sm",
        providerConfig.color,
        className
      )}
      onClick={handleClick}
      disabled={disabled || loading}
      loading={loading}
      aria-label={`Continuar com ${providerConfig.name}`}
      {...props}
    >
      <FontAwesomeIcon icon={providerConfig.icon} className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap max-[360px]:sr-only">{providerConfig.name}</span>
    </Button>
  )
}

// OAuth button group for displaying all providers
interface OAuthButtonGroupProps {
  className?: string
}

export function OAuthButtonGroup({ className }: OAuthButtonGroupProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2 sm:gap-3", className)}>
      {(Object.keys(OAUTH_PROVIDERS) as OAuthProvider[]).map((provider) => (
        <OAuthButton key={provider} provider={provider} />
      ))}
    </div>
  )
}
