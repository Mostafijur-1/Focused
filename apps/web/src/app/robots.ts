import type { MetadataRoute } from "next";

import { getServerEnvironment } from "@/lib/config/server-env";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getServerEnvironment().NEXT_PUBLIC_APP_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
