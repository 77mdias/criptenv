"use client"

import { useTranslations } from "next-intl"
import { FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PersonalVaultFolder } from "@/lib/api/personal-vault"

/** "all", "none" (no folder, or a folder that no longer exists) or a folder id. */
export type FolderSelection = "all" | "none" | string

export interface DecryptedFolder {
  folder: PersonalVaultFolder
  /** null = the name envelope does not decrypt (corrupt or tampered). */
  name: string | null
}

interface Props {
  folders: DecryptedFolder[]
  counts: Record<FolderSelection, number>
  selected: FolderSelection
  onSelect: (selection: FolderSelection) => void
  onNew: () => void
  newDisabled: boolean
  usage: string | null
}

export function FolderColumn({ folders, counts, selected, onSelect, onNew, newDisabled, usage }: Props) {
  const t = useTranslations("vault")
  const entries: { value: FolderSelection; label: string }[] = [
    { value: "all", label: t("folders.all") },
    ...folders.map(({ folder, name }) => ({ value: folder.id, label: name ?? t("folders.unreadable") })),
    { value: "none", label: t("folders.none") },
  ]
  return (
    // Phones: one scrollable row above the list. md and up: a column on the left.
    <nav aria-label={t("folders.title")} className="space-y-2 md:w-52 md:shrink-0">
      <div className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
        {entries.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={selected === value ? "primary" : "ghost"}
            aria-pressed={selected === value}
            aria-label={t("folders.entry", { name: label, count: counts[value] ?? 0 })}
            className="shrink-0 justify-between gap-3 md:w-full"
            onClick={() => onSelect(value)}
          >
            <span className="truncate">{label}</span>
            <span aria-hidden className="tabular-nums opacity-70">{counts[value] ?? 0}</span>
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          icon={FolderPlus}
          className="shrink-0 md:w-full md:justify-start"
          disabled={newDisabled}
          onClick={onNew}
        >
          {t("folders.new")}
        </Button>
      </div>
      {usage && <p className="text-xs text-(--text-muted)">{usage}</p>}
    </nav>
  )
}
