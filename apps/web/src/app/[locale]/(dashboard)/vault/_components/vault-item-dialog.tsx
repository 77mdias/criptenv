"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/client"
import { CryptoError } from "@/lib/crypto"
import { createPersonalVaultItem, updatePersonalVaultItem, type PersonalVaultConfig } from "@/lib/api/personal-vault"
import {
  decryptItem,
  encryptItem,
  unlockProtectedKey,
  type PersonalVaultItemPlain,
} from "@/lib/personal-vault/crypto"
import type { DecryptedEntry } from "./vault-items"

interface Props {
  /** `undefined` = closed, `null` = new item, an entry = edit it */
  entry: DecryptedEntry | null | undefined
  config: PersonalVaultConfig
  vaultKey: CryptoKey
  onClose: () => void
  onSaved: () => void
  /** The item changed or was deleted elsewhere: the list must reload, never retry. */
  onStale: (reason: "changed" | "deleted") => void
}

export function VaultItemDialog({ entry, ...rest }: Props) {
  return (
    <Dialog open={entry !== undefined} onOpenChange={(open) => !open && rest.onClose()}>
      <DialogContent className="max-w-lg">
        {entry !== undefined && <ItemForm key={entry?.item.id ?? "new"} entry={entry} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

const emptyForm = { type: "login" as "login" | "note", title: "", username: "", password: "", url: "", notes: "", content: "" }

const textareaClass =
  "flex min-h-20 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-base md:text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-2"
const labelClass = "block text-xs font-bold text-(--text-muted) uppercase tracking-wider font-mono"

function ItemForm({ entry, config, vaultKey, onSaved, onStale }: Omit<Props, "entry"> & { entry: DecryptedEntry | null }) {
  const t = useTranslations("vault")
  const [form, setForm] = useState(emptyForm)
  const [isProtected, setIsProtected] = useState(entry?.item.protected ?? false)
  // Editing a protected item starts locked: its body needs the extra password first.
  const [locked, setLocked] = useState(entry?.item.protected ?? false)
  const [extra, setExtra] = useState("")
  // The protected key is kept only while this dialog is open (unmounted on close).
  const protectedKey = useRef<CryptoKey | null>(null)
  const [hasProtectedKey, setHasProtectedKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // An edit must not save until the current item is decrypted, or blank fields would overwrite it.
  const [loaded, setLoaded] = useState(!entry)
  // Ids are minted here so the envelopes can be bound to them (AES-GCM AAD) before upload.
  const [itemId] = useState(() => entry?.item.id ?? crypto.randomUUID())

  function fill(plain: PersonalVaultItemPlain) {
    setForm({ ...emptyForm, ...plain })
    setLoaded(true)
  }

  useEffect(() => {
    if (!entry || entry.item.protected) return
    let cancelled = false
    decryptItem(entry.item, vaultKey, vaultKey)
      .then((plain) => {
        if (!cancelled) fill(plain)
      })
      .catch(() => {
        if (!cancelled) setError(t("errors.load"))
      })
    return () => {
      cancelled = true
    }
  }, [entry, vaultKey, t])

  async function withProtectedKey(): Promise<CryptoKey> {
    if (protectedKey.current) return protectedKey.current
    protectedKey.current = await unlockProtectedKey(config, vaultKey, extra)
    setHasProtectedKey(true)
    setExtra("")
    return protectedKey.current
  }

  function report(err: unknown) {
    setError(err instanceof CryptoError && err.code === "WRONG_PASSWORD" ? t("itemDialog.wrongExtra") : t("errors.save"))
  }

  async function handleUnlock(event: FormEvent) {
    event.preventDefault()
    if (!entry) return
    setBusy(true)
    setError(null)
    try {
      fill(await decryptItem(entry.item, vaultKey, await withProtectedKey()))
      setLocked(false)
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!loaded) return
    if (!form.title.trim()) {
      setError(t("itemDialog.titleRequired"))
      return
    }
    setBusy(true)
    setError(null)
    const plain: PersonalVaultItemPlain =
      form.type === "login"
        ? { type: "login", title: form.title, username: form.username, password: form.password, url: form.url, notes: form.notes }
        : { type: "note", title: form.title, content: form.content }
    try {
      const encrypted = await encryptItem(itemId, plain, vaultKey, isProtected ? await withProtectedKey() : null)
      if (entry) await updatePersonalVaultItem(entry.item.id, encrypted, entry.item.version)
      else await createPersonalVaultItem(encrypted)
      onSaved()
    } catch (err) {
      // Never retry: the other tab's version (or deletion) wins and the list reloads.
      if (err instanceof ApiError && err.status === 409) onStale("changed")
      else if (entry && err instanceof ApiError && err.status === 404) onStale("deleted")
      else report(err)
      setBusy(false)
    }
  }

  const set = (key: keyof typeof emptyForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const extraInput = (
    <Input
      label={t("passwords.extra")}
      type="password"
      autoComplete="off"
      value={extra}
      onChange={(event) => setExtra(event.target.value)}
    />
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry ? t("itemDialog.editTitle") : t("itemDialog.newTitle")}</DialogTitle>
        {locked && <DialogDescription>{t("itemDialog.unlockDescription")}</DialogDescription>}
      </DialogHeader>
      {locked ? (
        <form onSubmit={handleUnlock} className="space-y-4" noValidate>
          {extraInput}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={busy} disabled={!extra}>
            {t("itemDialog.unlock")}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {!entry && (
            <div className="space-y-1.5">
              <label htmlFor="vault-item-type" className={labelClass}>
                {t("itemDialog.type")}
              </label>
              <select id="vault-item-type" className={textareaClass + " min-h-10"} value={form.type} onChange={set("type")}>
                <option value="login">{t("itemDialog.typeLogin")}</option>
                <option value="note">{t("itemDialog.typeNote")}</option>
              </select>
            </div>
          )}
          <Input label={t("itemDialog.title")} value={form.title} onChange={set("title")} autoFocus />
          {form.type === "login" ? (
            <>
              <Input label={t("itemDialog.username")} autoComplete="off" value={form.username} onChange={set("username")} />
              <Input label={t("itemDialog.password")} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
              <Input label={t("itemDialog.url")} type="url" value={form.url} onChange={set("url")} />
              <div className="space-y-1.5">
                <label htmlFor="vault-item-notes" className={labelClass}>
                  {t("itemDialog.notes")}
                </label>
                <textarea id="vault-item-notes" className={textareaClass} value={form.notes} onChange={set("notes")} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="vault-item-content" className={labelClass}>
                {t("itemDialog.content")}
              </label>
              <textarea id="vault-item-content" className={textareaClass + " min-h-32"} value={form.content} onChange={set("content")} />
            </div>
          )}
          <div className="space-y-2">
            <Checkbox checked={isProtected} onChange={(event) => setIsProtected(event.target.checked)}>
              {t("itemDialog.protected")}
            </Checkbox>
            <p className="text-xs text-(--text-muted)">{t("itemDialog.protectedHelp")}</p>
            {isProtected && !hasProtectedKey && extraInput}
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" loading={busy} disabled={!loaded || (isProtected && !hasProtectedKey && !extra)}>
              {t("itemDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  )
}
