"use client"

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Bot, EyeOff, Send, X } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { supportApi, type SupportFailure, type SupportMessage } from "@/lib/api/support"
import { cn } from "@/lib/utils"

export const OPEN_SUPPORT_EVENT = "criptenv:open-support"
const HIDDEN_KEY = "criptenv-support-hidden"
const HISTORY_KEY = "criptenv-support-chat"
const MAX_QUESTION = 1000
// The server only reads this many; sending more just grows the request.
const CONTEXT_MESSAGES = 10

interface ChatEntry extends SupportMessage {
  /** A notice from the site itself (limit, error): shown, never sent to the model. */
  notice?: boolean
}

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // storage blocked (private mode): the preference just isn't remembered
  }
}

const INLINE = /(`[^`]+`|\[[^\]]+\]\((?:\/(?!\/)|https?:\/\/)[^)\s]+\)|(?:https?:\/\/[^\s)]+|(?<![\w/.])\/(?:docs|termos-de-uso|politica-de-privacidade|signup|login)[\w/#-]*))/g

function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE)
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>
        if (part.startsWith("`")) {
          return (
            <code key={index} className="rounded bg-(--background-muted) px-1 font-mono text-[0.85em]">
              {part.slice(1, -1)}
            </code>
          )
        }
        const markdown = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        const [label, href] = markdown ? [markdown[1], markdown[2]] : [part, part]
        return href.startsWith("/") ? (
          <Link key={index} href={href} className="text-(--accent) underline underline-offset-2">
            {label}
          </Link>
        ) : (
          <a key={index} href={href} target="_blank" rel="noreferrer" className="text-(--accent) underline underline-offset-2">
            {label}
          </a>
        )
      })}
    </>
  )
}

/** Plain text with code blocks, inline code and links: enough for short support answers. */
export function RichText({ text }: { text: string }): ReactNode {
  return text.split(/```[\w-]*\n?/).map((chunk, index) =>
    index % 2 === 1 ? (
      <pre key={index} className="my-2 overflow-x-auto rounded-lg bg-(--background-muted) p-2 font-mono text-xs">
        {chunk.replace(/\n$/, "")}
      </pre>
    ) : (
      <p key={index} className="whitespace-pre-wrap">
        <Inline text={chunk} />
      </p>
    )
  )
}

export function SupportChat() {
  const t = useTranslations("common.support")
  const locale = useLocale()
  const [enabled, setEnabled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void supportApi.status().then((on) => !cancelled && setEnabled(on))
    // Client-only storage: read after mount so the server render never depends on it.
    const timer = window.setTimeout(() => {
      setHidden(readStorage(() => window.localStorage, HIDDEN_KEY) === "1")
      const saved = readStorage(() => window.sessionStorage, HISTORY_KEY)
      if (saved) {
        try {
          // An answer cut off by a reload is saved empty: drop it.
          setEntries((JSON.parse(saved) as ChatEntry[]).filter((entry) => entry.content))
        } catch {
          writeStorage(() => window.sessionStorage, HISTORY_KEY, null)
        }
      }
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const openFromLink = () => {
      setHidden(false)
      writeStorage(() => window.localStorage, HIDDEN_KEY, null)
      setOpen(true)
    }
    window.addEventListener(OPEN_SUPPORT_EVENT, openFromLink)
    return () => window.removeEventListener(OPEN_SUPPORT_EVENT, openFromLink)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight })
  }, [entries])

  const close = useCallback(() => {
    setOpen(false)
    window.setTimeout(() => buttonRef.current?.focus(), 0)
  }, [])

  const hide = () => {
    writeStorage(() => window.localStorage, HIDDEN_KEY, "1")
    setHidden(true)
    setOpen(false)
  }

  const save = (next: ChatEntry[]) => {
    setEntries(next)
    writeStorage(() => window.sessionStorage, HISTORY_KEY, JSON.stringify(next))
  }

  const failureText: Record<SupportFailure, string> = {
    refusal: t("errors.refusal"),
    unavailable: t("errors.unavailable"),
    rate_limit: t("errors.rateLimit"),
    daily_limit: t("errors.dailyLimit"),
    off: t("errors.off"),
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const question = draft.trim()
    if (!question || busy) return
    setDraft("")
    setBusy(true)
    const asked = [...entries, { role: "user" as const, content: question }]
    save([...asked, { role: "assistant", content: "" }])
    let answer = ""
    const result = await supportApi.chat(
      asked
        .filter((entry) => !entry.notice && entry.content)
        .slice(-CONTEXT_MESSAGES)
        .map(({ role, content }) => ({ role, content })),
      locale,
      (text) => {
        answer += text
        setEntries([...asked, { role: "assistant", content: answer }])
      },
    )
    if (result.ok) {
      save([...asked, { role: "assistant", content: answer }])
    } else {
      const kept = answer ? [...asked, { role: "assistant" as const, content: answer }] : asked
      save([...kept, { role: "assistant", content: failureText[result.code], notice: true }])
    }
    setBusy(false)
  }

  if (!open) {
    if (!enabled || hidden) return null
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-(--accent) text-(--accent-foreground) shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
      >
        <Bot className="h-7 w-7" aria-hidden="true" />
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      onKeyDown={(event) => event.key === "Escape" && close()}
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(36rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--surface) shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
    >
      <div className="flex items-center gap-2 border-b border-(--border) px-4 py-3">
        <Bot className="h-5 w-5 text-(--accent)" aria-hidden="true" />
        <h2 className="flex-1 text-sm font-semibold text-(--text-primary)">{t("title")}</h2>
        <button type="button" onClick={hide} className="rounded-md p-1.5 text-(--text-muted) hover:bg-(--background-subtle)" aria-label={t("hide")} title={t("hide")}>
          <EyeOff className="h-4 w-4" />
        </button>
        <button type="button" onClick={close} className="rounded-md p-1.5 text-(--text-muted) hover:bg-(--background-subtle)" aria-label={t("close")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
        <p className="rounded-lg bg-(--background-subtle) px-3 py-2 text-xs text-(--text-tertiary)">{t("notice")}</p>
        {!enabled && <p className="text-(--text-secondary)">{t("errors.off")}</p>}
        {enabled && entries.length === 0 && <p className="text-(--text-secondary)">{t("greeting")}</p>}
        {entries.map((entry, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 leading-relaxed",
              entry.role === "user"
                ? "ml-auto bg-(--accent) text-(--accent-foreground)"
                : entry.notice
                  ? "bg-amber-500/10 text-(--text-secondary)"
                  : "bg-(--background-subtle) text-(--text-primary)"
            )}
          >
            {entry.role === "assistant" && !entry.content ? (
              <span className="text-(--text-muted)">{t("thinking")}</span>
            ) : entry.role === "assistant" ? (
              <RichText text={entry.content} />
            ) : (
              <p className="whitespace-pre-wrap">{entry.content}</p>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-(--border) p-3">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          maxLength={MAX_QUESTION}
          rows={2}
          disabled={!enabled}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="min-h-10 flex-1 resize-none rounded-lg border border-(--border) bg-(--background) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
        <button
          type="submit"
          disabled={!enabled || busy || !draft.trim()}
          aria-label={t("send")}
          className="grid h-10 w-10 place-items-center rounded-lg bg-(--accent) text-(--accent-foreground) disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
