import { assert, describe, it } from "@effect/vitest"
import { crawlerFiles, robotsTxt, sitemapXml } from "../../../../src/lib/seo/crawling.ts"

const production = { origin: "https://bluechip.markets", indexed: true, name: "bluechip", paper: false }
const paper = { origin: "https://paper.bluechip.markets", indexed: false, name: "bluechip paper", paper: true }

const pages = [
  { path: "/", updated: "2026-11-27", priority: 1 },
  { path: "/legal/terms", updated: "2026-11-25", priority: 0.3 }
]

describe("robotsTxt", () => {
  it("production opens the public pages, closes the app and points at the sitemap", () => {
    assert.strictEqual(
      robotsTxt(production),
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /home",
        "Disallow: /portfolio",
        "Disallow: /stocks",
        "Disallow: /agents",
        "Disallow: /automations",
        "Disallow: /activity",
        "Disallow: /approvals",
        "Disallow: /chat",
        "Disallow: /memory",
        "Disallow: /settings",
        "Disallow: /recover",
        "Disallow: /signin",
        "Disallow: /welcome/",
        "Disallow: /dev/",
        "",
        "Sitemap: https://bluechip.markets/sitemap.xml",
        ""
      ].join("\n")
    )
  })

  it("paper money closes everything", () => {
    assert.strictEqual(robotsTxt(paper), "User-agent: *\nDisallow: /\n")
  })
})

describe("sitemapXml", () => {
  it("production lists its public pages with their dates", () => {
    assert.strictEqual(
      sitemapXml(production, pages),
      [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        "  <url>",
        "    <loc>https://bluechip.markets/</loc>",
        "    <lastmod>2026-11-27</lastmod>",
        "    <priority>1.0</priority>",
        "  </url>",
        "  <url>",
        "    <loc>https://bluechip.markets/legal/terms</loc>",
        "    <lastmod>2026-11-25</lastmod>",
        "    <priority>0.3</priority>",
        "  </url>",
        "</urlset>",
        ""
      ].join("\n")
    )
  })

  it("a URL with XML's special characters is escaped", () => {
    assert.include(
      sitemapXml(production, [{ path: "/a?b=1&c=2", updated: "2026-11-27", priority: 0.5 }]),
      "<loc>https://bluechip.markets/a?b=1&amp;c=2</loc>"
    )
  })
})

describe("crawlerFiles", () => {
  it("production: robots, the manifest and the sitemap", () => {
    assert.deepStrictEqual(Object.keys(crawlerFiles(production, pages)), [
      "robots.txt",
      "manifest.webmanifest",
      "sitemap.xml"
    ])
  })

  it("paper money: robots closing everything and the manifest, no sitemap", () => {
    const files = crawlerFiles(paper, pages)

    assert.deepStrictEqual(Object.keys(files), ["robots.txt", "manifest.webmanifest"])
    assert.strictEqual(files["robots.txt"], "User-agent: *\nDisallow: /\n")
    assert.strictEqual(JSON.parse(files["manifest.webmanifest"] ?? "").name, "bluechip paper")
  })
})
