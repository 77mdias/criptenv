"use client";

import { useTranslations } from "next-intl";
import {
  CircleHelp,
  ExternalLink,
  FileText,
  MessageCircle,
  Shield,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export default function HelpPage() {
  const t = useTranslations("help");

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-(--text-tertiary) text-sm font-mono mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <a href="/docs" target="_blank" rel="noopener noreferrer">
          <Card className="p-4 md:p-6 hover:shadow-lg transition-all cursor-pointer h-full">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent)/10">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-(--accent)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-(--text-primary)">
                    {t("docs.title")}
                  </h3>
                  <ExternalLink className="h-3 w-3 text-(--text-muted) shrink-0" />
                </div>
                <p className="text-sm text-(--text-muted) font-mono mt-1">
                  {t("docs.description")}
                </p>
              </div>
            </div>
          </Card>
        </a>

        <a
          href="https://github.com/77mdias/criptenv/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Card className="p-4 md:p-6 hover:shadow-lg transition-all cursor-pointer h-full">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent)/10">
                <MessageCircle className="h-4 w-4 md:h-5 md:w-5 text-(--accent)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-(--text-primary)">
                    {t("support.title")}
                  </h3>
                  <ExternalLink className="h-3 w-3 text-(--text-muted) shrink-0" />
                </div>
                <p className="text-sm text-(--text-muted) font-mono mt-1">
                  {t("support.description")}
                </p>
              </div>
            </div>
          </Card>
        </a>
      </div>

      {/* FAQ */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <CircleHelp className="h-5 w-5 text-(--accent) shrink-0" />
          <h2 className="text-lg font-semibold">{t("faq.title")}</h2>
        </div>

        <div className="space-y-5 md:space-y-6">
          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              {t("faq.q1")}
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              {t("faq.a1")}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              {t("faq.q2")}
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              {t("faq.a2")}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              {t("faq.q3")}
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              {t("faq.a3")}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              {t("faq.q4")}
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              {t("faq.a4")}
            </p>
          </div>
        </div>
      </Card>

      {/* Security Notice */}
      <Card className="p-4 md:p-6 border-(--accent)/50">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent)/10">
            <Shield className="h-4 w-4 md:h-5 md:w-5 text-(--accent)" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-(--text-primary)">
              {t("security.title")}
            </h3>
            <p className="text-sm text-(--text-muted) font-mono mt-1">
              {t("security.description")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
