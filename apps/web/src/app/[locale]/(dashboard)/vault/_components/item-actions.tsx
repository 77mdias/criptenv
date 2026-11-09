"use client"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { useTranslations } from "next-intl"
import { Copy, Eye, FolderInput, MoreVertical, Pencil, Trash2, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  title: string
  /** Shows "copy username" when set. */
  username?: string
  onCopyUsername: () => void
  onReveal: () => void
  onMove: () => void
  onEdit: () => void
  onDelete: () => void
}

interface Action {
  key: string
  icon: LucideIcon
  label: string
  menuLabel: string
  onSelect: () => void
  danger?: boolean
}

/**
 * An item's actions: inline icon buttons from `sm` up, folded into a "more"
 * menu on phones, where five buttons leave the title no room.
 */
export function ItemActions({ title, username, onCopyUsername, onReveal, onMove, onEdit, onDelete }: Props) {
  const t = useTranslations("vault")

  const actions: Action[] = [
    ...(username
      ? [{ key: "copy", icon: Copy, label: t("items.copyUsername", { title }), menuLabel: t("items.menu.copyUsername"), onSelect: onCopyUsername }]
      : []),
    { key: "reveal", icon: Eye, label: t("items.reveal", { title }), menuLabel: t("items.menu.reveal"), onSelect: onReveal },
    { key: "move", icon: FolderInput, label: t("items.move", { title }), menuLabel: t("items.menu.move"), onSelect: onMove },
    { key: "edit", icon: Pencil, label: t("items.edit", { title }), menuLabel: t("items.menu.edit"), onSelect: onEdit },
    { key: "delete", icon: Trash2, label: t("items.delete", { title }), menuLabel: t("items.menu.delete"), onSelect: onDelete, danger: true },
  ]

  return (
    <>
      <div className="hidden shrink-0 gap-1 sm:flex">
        {actions.map(({ key, icon: Icon, label, onSelect }) => (
          <Button key={key} type="button" size="icon" variant="ghost" aria-label={label} onClick={onSelect}>
            <Icon aria-hidden className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button type="button" size="icon" variant="ghost" className="shrink-0 sm:hidden" aria-label={t("items.actions", { title })}>
            <MoreVertical aria-hidden className="h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-48 overflow-hidden rounded-lg border border-(--border) bg-(--surface-elevated) p-1 shadow-xl shadow-black/20"
          >
            {actions.map(({ key, icon: Icon, menuLabel, onSelect, danger }) => (
              <DropdownMenu.Item
                key={key}
                // Run the action once the menu has closed: a dialog opened in the same tick as a
                // modal menu closes can leave `pointer-events: none` stuck on <body>.
                onSelect={() => setTimeout(onSelect, 0)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none transition-colors data-[highlighted]:bg-(--background-subtle)",
                  danger ? "text-red-600" : "text-(--text-secondary) data-[highlighted]:text-(--text-primary)",
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
                <span>{menuLabel}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  )
}
