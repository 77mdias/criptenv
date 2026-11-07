"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/client"
import { createPersonalVaultFolder, isPlanLimitError, updatePersonalVaultFolder } from "@/lib/api/personal-vault"
import { encryptFolderName } from "@/lib/personal-vault/crypto"
import type { DecryptedFolder } from "./folder-column"

const MAX_NAME = 100

interface Props {
  /** `undefined` = closed, `null` = new folder, a folder = rename it */
  folder: DecryptedFolder | null | undefined
  vaultKey: CryptoKey
  onClose: () => void
  onSaved: () => void
  /** The folder changed or was deleted elsewhere: the list must reload, never retry. */
  onStale: () => void
  /** The plan's folder limit was reached. */
  onLimit: () => void
}

export function FolderDialog({ folder, ...rest }: Props) {
  return (
    <Dialog open={folder !== undefined} onOpenChange={(open) => !open && rest.onClose()}>
      <DialogContent className="max-w-sm">
        {folder !== undefined && <FolderForm key={folder?.folder.id ?? "new"} folder={folder} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function FolderForm({ folder, vaultKey, onSaved, onStale, onLimit }: Omit<Props, "folder"> & { folder: DecryptedFolder | null }) {
  const t = useTranslations("vault")
  const [name, setName] = useState(folder?.name ?? "")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Minted here so the name envelope can be bound to it (AES-GCM AAD) before upload.
  const [folderId] = useState(() => folder?.folder.id ?? crypto.randomUUID())

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError(t("folderDialog.nameRequired"))
    if (trimmed.length > MAX_NAME) return setError(t("folderDialog.nameTooLong"))
    setBusy(true)
    setError(null)
    // True once this save targets a copy that already exists on the server.
    let existing = folder !== null
    try {
      const sealed = await encryptFolderName(folderId, trimmed, vaultKey)
      if (folder) {
        await updatePersonalVaultFolder(folderId, sealed, folder.folder.version)
      } else {
        try {
          await createPersonalVaultFolder({ id: folderId, name: sealed })
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 409 && err.message === "Folder id already exists")) throw err
          // An earlier save of this new folder landed but its response was lost; a new folder is at version 1.
          existing = true
          await updatePersonalVaultFolder(folderId, sealed, 1)
        }
      }
      onSaved()
    } catch (err) {
      if (isPlanLimitError(err)) onLimit()
      else if (existing && err instanceof ApiError && (err.status === 409 || err.status === 404)) onStale()
      else setError(t("errors.save"))
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{folder ? t("folderDialog.editTitle") : t("folderDialog.newTitle")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input label={t("folderDialog.name")} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button type="submit" loading={busy}>
            {t("folderDialog.save")}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
