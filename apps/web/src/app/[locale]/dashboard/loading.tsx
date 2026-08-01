"use client";

import { useParams } from "next/navigation";

import { DashboardSkeleton } from "@/features/dashboard/ui/dashboard-skeleton";
import { getDashboardCopy } from "@/features/dashboard/ui/dashboard-copy";
import { isLocale } from "@/i18n/config";

export default function Loading() {
  const { locale: candidate } = useParams<{ locale: string }>();
  const locale = isLocale(candidate) ? candidate : "bn-BD";
  return <DashboardSkeleton copy={getDashboardCopy(locale)} />;
}
