"use client"

import { useTranslations } from "next-intl"

import { OPEN_SUPPORT_EVENT } from "./support-chat"

/** Footer entry to the support chat: opens it even after the visitor hid the bot button. */
export function SupportLink({ className }: { className?: string }) {
  const t = useTranslations("common.support")
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_EVENT))} className={className}>
      {t("footerLink")}
    </button>
  )
}
