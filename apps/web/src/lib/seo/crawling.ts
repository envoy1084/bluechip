import { webManifest } from "./manifest.ts"
import { canonicalUrl, type Site } from "./site.ts"

/** Where crawlers never go on production: the signed-in app, its API and the analytics relay. */
const PRIVATE_PATHS = [
  "/home",
  "/portfolio",
  "/stocks",
  "/agents",
  "/automations",
  "/activity",
  "/approvals",
  "/chat",
  "/memory",
  "/settings",
  "/recover",
  "/signin",
  "/welcome/",
  "/dev/",
  "/api/",
  "/auth/",
  "/ingest/"
]

/** `robots.txt`: production opens its public pages and points at the sitemap; paper money and local close everything. */
export const robotsTxt = (site: Site): string => {
  if (!site.indexed) return "User-agent: *\nDisallow: /\n"

  return [
    "User-agent: *",
    "Allow: /",
    ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${site.origin}/sitemap.xml`,
    ""
  ].join("\n")
}

/** A public page in the sitemap. */
export interface SitemapPage {
  readonly path: string
  /** The day it last changed, `2026-11-25`. */
  readonly updated: string
  readonly priority: number
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** `sitemap.xml`: the public pages with the day each last changed. */
export const sitemapXml = (site: Site, pages: ReadonlyArray<SitemapPage>): string =>
  [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...pages.map((page) =>
      [
        "  <url>",
        `    <loc>${escapeXml(canonicalUrl(page.path, site))}</loc>`,
        `    <lastmod>${page.updated}</lastmod>`,
        `    <priority>${page.priority.toFixed(1)}</priority>`,
        "  </url>"
      ].join("\n")
    ),
    "</urlset>",
    ""
  ].join("\n")

/**
 * The files the build writes beside the pages, by name: `robots.txt` and the manifest everywhere, and the sitemap on
 * production only (paper money and local list nothing and close everything).
 */
export const crawlerFiles = (site: Site, pages: ReadonlyArray<SitemapPage>): Readonly<Record<string, string>> => ({
  "robots.txt": robotsTxt(site),
  "manifest.webmanifest": JSON.stringify(webManifest(site), null, 2) + "\n",
  ...(site.indexed ? { "sitemap.xml": sitemapXml(site, pages) } : {})
})
