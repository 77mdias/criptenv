"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, Copy } from "lucide-react"

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  language?: string
  title?: string
  showLineNumbers?: boolean
  code?: string
}

function CodeBlock({
  children,
  language = "",
  title,
  showLineNumbers = false,
  code,
  className,
  ...props
}: CodeBlockProps) {
  const content = code || children
  const [copied, setCopied] = React.useState(false)
  const codeRef = React.useRef<HTMLElement>(null)

  const handleCopy = async () => {
    if (!codeRef.current) return
    const text = codeRef.current.textContent || ""
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("group relative my-4 rounded-lg border border-[var(--border)] overflow-hidden", className)}>
      {/* Header */}
      {(title || language) && (
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--background-muted)] border-b border-[var(--border)]">
          <span className="text-xs font-mono text-[var(--text-tertiary)]">
            {title || language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors rounded-md hover:bg-[var(--background-subtle)]"
            aria-label="Copiar código"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Code */}
      <div className="relative">
        {!title && !language && (
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors rounded-md hover:bg-[var(--background-muted)] opacity-0 group-hover:opacity-100"
            aria-label="Copiar código"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <pre
          className={cn(
            "overflow-x-auto p-4 text-sm leading-relaxed",
            "bg-[var(--docs-code-bg,var(--background-subtle))]",
            "text-[var(--text-primary)]",
            showLineNumbers && "pl-12"
          )}
          {...props}
        >
          <code ref={codeRef} className={language ? `language-${language}` : ""}>
            {content}
          </code>
        </pre>
      </div>
    </div>
  )
}

/* Inline code */
function InlineCode({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(
        "px-1.5 py-0.5 rounded-md text-sm font-mono",
        "bg-[var(--background-muted)] text-[var(--text-primary)]",
        "border border-[var(--border-subtle)]",
        className
      )}
      {...props}
    >
      {children}
    </code>
  )
}

export { CodeBlock, InlineCode }
