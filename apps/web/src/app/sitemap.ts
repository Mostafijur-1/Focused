import type { MetadataRoute } from "next";

import { locales } from "@/i18n/config";
import { getServerEnvironment } from "@/lib/config/server-env";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getServerEnvironment().NEXT_PUBLIC_APP_URL;
  return locales.map((locale) => ({
    url: `${appUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: locale === "bn-BD" ? 1 : 0.9,
    alternates: {
      languages: {
        "bn-BD": `${appUrl}/bn-BD`,
        en: `${appUrl}/en`,
      },
    },
  }));
}
