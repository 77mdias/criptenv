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
    color: "hover:bg-[#24292e] hover:border-[#24292e]",
    bgColor: "bg-[#24292e]",
  },
  google: {
    name: "Google",
    icon: faGoogle,
    color: "hover:bg-[#4285f4] hover:border-[#4285f4]",
    bgColor: "bg-[#4285f4]",
  },
  discord: {
    name: "Discord",
    icon: faDiscord,
    color: "hover:bg-[#5865F2] hover:border-[#5865F2]",
    bgColor: "bg-[#5865F2]",
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
        "w-full gap-2 transition-all duration-200",
        providerConfig.color,
        className
      )}
      onClick={handleClick}
      disabled={disabled || loading}
      loading={loading}
      {...props}
    >
      <FontAwesomeIcon icon={providerConfig.icon} className="h-4 w-4" />
      Entrar com {providerConfig.name}
    </Button>
  )
}

// OAuth button group for displaying all providers
interface OAuthButtonGroupProps {
  className?: string
}

export function OAuthButtonGroup({ className }: OAuthButtonGroupProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(Object.keys(OAUTH_PROVIDERS) as OAuthProvider[]).map((provider) => (
        <OAuthButton key={provider} provider={provider} />
      ))}
    </div>
  )
}
