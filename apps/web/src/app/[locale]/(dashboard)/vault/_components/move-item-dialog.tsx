"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ApiError } from "@/lib/api/client"
import { updatePersonalVaultItem } from "@/lib/api/personal-vault"
import { resealSummary, type ItemSummary } from "@/lib/personal-vault/crypto"
import type { DecryptedFolder } from "./folder-column"
import { FolderSelect } from "./vault-item-dialog"
import type { DecryptedEntry } from "./vault-items"

interface Props {
  entry: DecryptedEntry | null
  folders: DecryptedFolder[]
  vaultKey: CryptoKey
  onClose: () => void
  onSaved: () => void
  /** The item changed or was deleted elsewhere: the list must reload, never retry. */
  onStale: (reason: "changed" | "deleted") => void
}

export function MoveItemDialog({ entry, ...rest }: Props) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && rest.onClose()}>
      <DialogContent className="max-w-sm">{entry && <MoveForm key={entry.item.id} entry={entry} {...rest} />}</DialogContent>
    </Dialog>
  )
}

function MoveForm({ entry, folders, vaultKey, onSaved, onStale }: Omit<Props, "entry"> & { entry: DecryptedEntry }) {
  const t = useTranslations("vault")
  const [folderId, setFolderId] = useState(entry.summary.folderId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { item, summary } = entry
    const next: ItemSummary = { ...summary }
    delete next.folderId
    if (folderId) next.folderId = folderId
    try {
      // Only the summary (VK) changes; the body envelope goes back untouched, so a
      // protected item moves without its extra password ever being asked for.
      const sealed = await resealSummary(item.id, next, vaultKey)
      await updatePersonalVaultItem(item.id, { id: item.id, protected: item.protected, summary: sealed, body: item.body }, item.version)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) onStale("changed")
      else if (err instanceof ApiError && err.status === 404) onStale("deleted")
      else setError(t("errors.save"))
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("moveDialog.title", { title: entry.summary.title })}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FolderSelect id="vault-move-folder" label={t("moveDialog.folder")} folders={folders} value={folderId} onChange={setFolderId} />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button type="submit" loading={busy}>
            {t("moveDialog.save")}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
