import type { MetadataRoute } from "next";

/**
 * PWA manifest. Next 14 auto-serves this at /manifest.webmanifest and
 * registers it via <link rel="manifest"> on every page.
 *
 * start_url is /app so opening from the home screen lands the user
 * inside the product loop, not on the marketing page. Unauthed users
 * get bounced to /login by the middleware on first launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vigilance",
    short_name: "Vigilance",
    description:
      "A 30-second daily ritual against financial drift. Multi-account check-in, CFO-grade hints, weekly reckoning, monthly close.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F1EB",
    theme_color: "#F04E37",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
