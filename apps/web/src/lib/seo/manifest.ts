import { type Site, SITE_DESCRIPTION } from "./site.ts"

/**
 * The web app manifest: installed, bluechip opens on your home page, standalone, in the brand's light colors. A landing
 * whose app is on another site isn't an app to install (a manifest's start URL must be on its own site): it opens in
 * the browser, at the landing.
 */
export const webManifest = (site: Site) => ({
  id: site.app === null ? "/home" : "/",
  name: site.name,
  short_name: site.name,
  description: SITE_DESCRIPTION,
  lang: "en",
  dir: "ltr",
  start_url: site.app === null ? "/home" : "/",
  scope: "/",
  display: site.app === null ? "standalone" : "browser",
  orientation: "any",
  background_color: "#ffffff",
  theme_color: "#ffffff",
  categories: ["finance", "productivity"],
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
  ]
})
