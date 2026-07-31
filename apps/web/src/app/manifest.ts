import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Focused — Focus Operating System",
    short_name: "Focused",
    description:
      "A Bangla-first Focus Operating System for calm, meaningful progress.",
    start_url: "/bn-BD",
    display: "standalone",
    background_color: "#09090B",
    theme_color: "#E60076",
    lang: "bn-BD",
    categories: ["productivity", "lifestyle"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
