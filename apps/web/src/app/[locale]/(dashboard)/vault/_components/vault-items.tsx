"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Copy, Eye, KeyRound, Lock, Pencil, Plus, Settings, ShieldAlert, ShieldCheck, StickyNote, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import {
  deletePersonalVaultFolder,
  deletePersonalVaultItem,
  listPersonalVaultFolders,
  listPersonalVaultItems,
  type PersonalVaultConfig,
  type PersonalVaultItem,
} from "@/lib/api/personal-vault"
import { ApiError } from "@/lib/api/client"
import { meApi, type Plan } from "@/lib/api/me"
import { decryptFolderName, decryptSummary, type ItemSummary } from "@/lib/personal-vault/crypto"
import { FolderColumn, type DecryptedFolder, type FolderSelection } from "./folder-column"
import { FolderDialog } from "./folder-dialog"
import { ProtectedRevealDialog } from "./protected-reveal-dialog"
import { VaultItemDialog } from "./vault-item-dialog"
import { VaultSettingsDialog } from "./vault-settings-dialog"
import { usePersonalVaultSession } from "./vault-session"
import { SiteIcon } from "./site-icon"
import { readSiteIconsSetting, writeSiteIconsSetting } from "@/lib/personal-vault/site-icons"

export interface DecryptedEntry {
  item: PersonalVaultItem
  summary: ItemSummary
}

interface Props {
  vaultKey: CryptoKey
  config: PersonalVaultConfig
  onConfigChange: (config: PersonalVaultConfig) => void
}

const FILTERS = [
  { value: "all", label: "items.filterAll" },
  { value: "login", label: "items.filterLogin" },
  { value: "note", label: "items.filterNote" },
] as const
type Filter = (typeof FILTERS)[number]["value"]

export function VaultItems({ vaultKey, config, onConfigChange }: Props) {
  const t = useTranslations("vault")
  const { lock } = usePersonalVaultSession()
  const [entries, setEntries] = useState<DecryptedEntry[] | null>(null)
  // Items whose envelopes do not decrypt (corrupt or tampered): listed apart, delete-only.
  const [unreadable, setUnreadable] = useState<PersonalVaultItem[]>([])
  const [reloadToken, setReloadToken] = useState(0)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [folders, setFolders] = useState<DecryptedFolder[]>([])
  const [selected, setSelected] = useState<FolderSelection>("all")
  const [folderDialog, setFolderDialog] = useState<DecryptedFolder | null | undefined>(undefined)
  // null = unknown (not loaded or failed): no usage shown and nothing disabled; the API still enforces limits.
  const [plan, setPlan] = useState<Plan | null>(null)
  // A 402 from the server: the limit is reached even if the plan above is unknown or stale.
  const [limitHit, setLimitHit] = useState<"items" | "folders" | null>(null)
  const [revealing, setRevealing] = useState<DecryptedEntry | null>(null)
  const [editing, setEditing] = useState<DecryptedEntry | null | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The list only renders after unlock, in the browser, so reading storage here cannot mismatch SSR.
  const [siteIcons, setSiteIcons] = useState(readSiteIconsSetting)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listPersonalVaultItems(), listPersonalVaultFolders()])
      .then(async ([items, folderRows]) => {
        const [results, names] = await Promise.all([
          Promise.allSettled(items.map((item) => decryptSummary(item.id, item.summary, vaultKey))),
          Promise.allSettled(folderRows.map((f) => decryptFolderName(f.id, f.name, vaultKey))),
        ])
        if (cancelled) return
        setEntries(results.flatMap((r, i) => (r.status === "fulfilled" ? [{ item: items[i], summary: r.value }] : [])))
        setUnreadable(items.filter((_, i) => results[i].status === "rejected"))
        setFolders(
          folderRows
            .map((folder, i) => ({ folder, name: names[i].status === "fulfilled" ? names[i].value : null }))
            // Alphabetical; unreadable folders last.
            .sort((a, b) => (a.name === null ? 1 : b.name === null ? -1 : a.name.localeCompare(b.name))),
        )
      })
      .catch(() => {
        if (!cancelled) setError(t("errors.load"))
      })
    return () => {
      cancelled = true
    }
  }, [vaultKey, reloadToken, t])

  useEffect(() => {
    let cancelled = false
    meApi
      .plan()
      .then((value) => !cancelled && setPlan(value))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const folderIds = useMemo(() => new Set(folders.map(({ folder }) => folder.id)), [folders])
  // An item pointing at a folder that no longer exists belongs to "none".
  const folderOf = useMemo(
    () => (summary: ItemSummary): FolderSelection =>
      summary.folderId && folderIds.has(summary.folderId) ? summary.folderId : "none",
    [folderIds],
  )
  // A selected folder deleted elsewhere falls back to "all".
  const current: FolderSelection = selected === "all" || selected === "none" || folderIds.has(selected) ? selected : "all"
  const currentFolder = folders.find(({ folder }) => folder.id === current)

  const counts = useMemo(() => {
    const result: Record<FolderSelection, number> = { all: entries?.length ?? 0, none: 0 }
    for (const { summary } of entries ?? []) {
      const key = folderOf(summary)
      result[key] = (result[key] ?? 0) + 1
    }
    return result
  }, [entries, folderOf])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (entries ?? []).filter(({ summary }) => {
      if (current !== "all" && folderOf(summary) !== current) return false
      if (filter !== "all" && summary.type !== filter) return false
      if (!needle) return true
      return [summary.title, summary.username, summary.url].some((value) => value?.toLowerCase().includes(needle))
    })
  }, [entries, query, filter, current, folderOf])

  const itemLimit = plan?.limits.personal_vault_items ?? null
  const folderLimit = plan?.limits.personal_vault_folders ?? null
  const itemCount = (entries?.length ?? 0) + unreadable.length
  const itemsFull = entries !== null && itemLimit !== null && itemCount >= itemLimit
  const foldersFull = folderLimit !== null && folders.length >= folderLimit
  const folderUsage = plan
    ? folderLimit === null
      ? t("folders.usageUnlimited", { used: folders.length })
      : t("folders.usage", { used: folders.length, max: folderLimit })
    : null
  const itemUsage =
    plan && entries
      ? itemLimit === null
        ? t("items.usageUnlimited", { used: itemCount })
        : t("items.usage", { used: itemCount, max: itemLimit })
      : null
  const currentLabel =
    current === "all" ? t("folders.all") : current === "none" ? t("folders.none") : (currentFolder?.name ?? t("folders.unreadable"))

  const reload = () => setReloadToken((n) => n + 1)

  async function handleDelete(itemId: string, title: string) {
    if (!window.confirm(t("items.deleteConfirm", { title }))) return
    try {
      await deletePersonalVaultItem(itemId)
      reload()
    } catch (err) {
      // Already deleted in another tab: the goal is met, just refresh the list.
      if (err instanceof ApiError && err.status === 404) reload()
      else setError(t("errors.save"))
    }
  }

  async function handleDeleteFolder(target: DecryptedFolder) {
    const name = target.name ?? t("folders.unreadable")
    if (!window.confirm(t("folders.deleteConfirm", { name }))) return
    try {
      // Only the folder row goes: its items fall under "none" on their own.
      await deletePersonalVaultFolder(target.folder.id)
      setSelected("all")
      setLimitHit(null)
      reload()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) reload()
      else setError(t("errors.save"))
    }
  }

  function copy(value: string) {
    void navigator.clipboard?.writeText(value).then(() => setNotice(t("items.copied")))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" icon={Plus} disabled={itemsFull} onClick={() => setEditing(null)}>
          {t("items.new")}
        </Button>
        {itemUsage && <span className="text-xs text-(--text-muted)">{itemUsage}</span>}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" icon={Settings} onClick={() => setSettingsOpen(true)}>
            {t("items.settings")}
          </Button>
          <Button type="button" variant="secondary" icon={Lock} onClick={lock}>
            {t("items.lock")}
          </Button>
        </div>
      </div>

      {/* shortcut: the notices name the free plan because it is the only plan with limits; use the plan's name once paid plans exist */}
      {(itemsFull || limitHit === "items") && <p role="status" className="text-sm text-(--text-secondary)">{t("items.limitReached")}</p>}
      {(foldersFull || limitHit === "folders") && (
        <p role="status" className="text-sm text-(--text-secondary)">{t("folders.limitReached")}</p>
      )}

      <div className="flex flex-col gap-5 md:flex-row">
        <FolderColumn
          folders={folders}
          counts={counts}
          selected={current}
          onSelect={setSelected}
          onNew={() => setFolderDialog(null)}
          newDisabled={foldersFull}
          usage={folderUsage}
        />
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex items-center gap-1">
            <h2 className="truncate text-base font-semibold">{currentLabel}</h2>
            {currentFolder && currentFolder.name !== null && (
              <Button type="button" size="icon" variant="ghost" aria-label={t("folders.rename", { name: currentLabel })} onClick={() => setFolderDialog(currentFolder)}>
                <Pencil aria-hidden className="h-4 w-4" />
              </Button>
            )}
            {currentFolder && (
              <Button type="button" size="icon" variant="ghost" aria-label={t("folders.delete", { name: currentLabel })} onClick={() => void handleDeleteFolder(currentFolder)}>
                <Trash2 aria-hidden className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input label={t("items.search")} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="flex gap-1" role="group">
              {FILTERS.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={filter === value ? "primary" : "ghost"}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {t(label)}
                </Button>
              ))}
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {notice && <p role="status" className="text-sm text-(--text-secondary)">{notice}</p>}
          {!entries && !error && <Skeleton className="h-24 w-full" />}
          {entries?.length === 0 && unreadable.length === 0 && (
            <EmptyState icon={KeyRound} title={t("items.empty")} description={t("items.emptyDescription")} />
          )}
          {entries && entries.length > 0 && visible.length === 0 && (query.trim() || filter !== "all" || current !== "all") && (
            <p className="text-sm text-(--text-muted)">{t("items.noResults")}</p>
          )}
          {visible.length > 0 && (
            <ul className="divide-y divide-(--border) rounded-lg border border-(--border)">
              {visible.map((entry) => {
                const { item, summary } = entry
                return (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {summary.type === "login" ? (
                      <SiteIcon url={summary.url} enabled={siteIcons} />
                    ) : (
                      <StickyNote aria-hidden className="h-4 w-4 shrink-0 text-(--text-muted)" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <span className="truncate">{summary.title}</span>
                        {item.protected && (
                          <ShieldCheck role="img" aria-label={t("items.protected")} className="h-3.5 w-3.5 shrink-0 text-(--accent)" />
                        )}
                      </p>
                      {summary.username && <p className="truncate text-xs text-(--text-muted)">{summary.username}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {summary.username && (
                        <Button type="button" size="icon" variant="ghost" aria-label={t("items.copyUsername", { title: summary.title })} onClick={() => copy(summary.username!)}>
                          <Copy aria-hidden className="h-4 w-4" />
                        </Button>
                      )}
                      <Button type="button" size="icon" variant="ghost" aria-label={t("items.reveal", { title: summary.title })} onClick={() => setRevealing(entry)}>
                        <Eye aria-hidden className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={t("items.edit", { title: summary.title })} onClick={() => setEditing(entry)}>
                        <Pencil aria-hidden className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={t("items.delete", { title: summary.title })} onClick={() => void handleDelete(item.id, summary.title)}>
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {unreadable.length > 0 && !query.trim() && filter === "all" && current === "all" && (
            <ul className="divide-y divide-(--border) rounded-lg border border-dashed border-(--border)">
              {unreadable.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <ShieldAlert aria-hidden className="h-4 w-4 shrink-0 text-red-600" />
                  <p className="min-w-0 flex-1 truncate text-sm text-(--text-muted)">{t("items.unreadable")}</p>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t("items.delete", { title: t("items.unreadable") })}
                    onClick={() => void handleDelete(item.id, t("items.unreadable"))}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

        </div>
      </div>

      <FolderDialog
        folder={folderDialog}
        vaultKey={vaultKey}
        onClose={() => setFolderDialog(undefined)}
        onSaved={() => {
          setFolderDialog(undefined)
          setNotice(null)
          setLimitHit(null)
          reload()
        }}
        onStale={() => {
          setFolderDialog(undefined)
          setNotice(t("folderDialog.conflict"))
          reload()
        }}
        onLimit={() => {
          setFolderDialog(undefined)
          setLimitHit("folders")
          reload()
        }}
      />
      <ProtectedRevealDialog entry={revealing} config={config} vaultKey={vaultKey} onClose={() => setRevealing(null)} />
      <VaultItemDialog
        entry={editing}
        config={config}
        vaultKey={vaultKey}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined)
          setNotice(null)
          reload()
        }}
        onStale={(reason) => {
          setEditing(undefined)
          setNotice(reason === "deleted" ? t("itemDialog.deleted") : t("itemDialog.conflict"))
          reload()
        }}
      />
      <VaultSettingsDialog
        open={settingsOpen}
        config={config}
        vaultKey={vaultKey}
        onClose={() => setSettingsOpen(false)}
        onConfigChange={onConfigChange}
        siteIcons={siteIcons}
        onSiteIconsChange={(on) => {
          writeSiteIconsSetting(on)
          setSiteIcons(on)
        }}
      />
    </div>
  )
}
