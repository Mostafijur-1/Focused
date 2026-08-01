import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Focused — Focus Operating System",
    short_name: "Focused",
    description:
      "A Bangla-first Focus Operating System for calm, meaningful progress.",
    start_url: "/bn-BD",
    scope: "/",
    display: "standalone",
    background_color: "#09090B",
    theme_color: "#C40063",
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
    shortcuts: [
      {
        name: "আজকের Focus",
        short_name: "Focus",
        description: "সরাসরি Focus Timer খুলুন",
        url: "/bn-BD/focus",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Dashboard খুলুন",
        short_name: "Dashboard",
        description: "আজকের অগ্রগতি দেখুন",
        url: "/bn-BD/dashboard",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}
