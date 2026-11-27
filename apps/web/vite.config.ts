import { networks } from "@bluechip/chain/Network"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { LEGAL_DOCUMENTS } from "./src/features/legal/model/documents.ts"
import { crawlerFiles, type SitemapPage } from "./src/lib/seo/crawling.ts"
import { siteOf } from "./src/lib/seo/site.ts"

/**
 * `robots.txt`, `manifest.webmanifest` and, on production, `sitemap.xml` for this build's site: written beside the
 * pages when it builds, served by the development server.
 */
const crawlerFilesPlugin = (files: Readonly<Record<string, string>>): Plugin => ({
  name: "bluechip:crawler-files",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const file = files[request.url?.split("?")[0]?.slice(1) ?? ""]
      if (file === undefined) return next()
      const type = request.url?.endsWith(".xml") ? "application/xml" : request.url?.endsWith(".webmanifest") ?
        "application/manifest+json" :
        "text/plain"
      response.setHeader("Content-Type", type)
      response.end(file)
    })
  },
  applyToEnvironment: (environment) => environment.name === "client",
  generateBundle() {
    for (const [fileName, source] of Object.entries(files)) this.emitFile({ type: "asset", fileName, source })
  }
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "")
  // The browser only talks to the web app's origin; in development Vite forwards the server's paths to it.
  const server = env["SERVER_ORIGIN"] ?? "http://localhost:8080"
  const network = networks.find((candidate) => candidate === env["VITE_NETWORK"]) ?? "local"
  const site = siteOf(network, env["VITE_SITE_URL"])

  // The public pages: prerendered to HTML with their head; every other path is the SPA shell. The landing changes
  // with each release, so its sitemap date is the build's.
  const pages: ReadonlyArray<SitemapPage> = [
    { path: "/", updated: new Date().toISOString().slice(0, 10), priority: 1 },
    ...LEGAL_DOCUMENTS.map((legal) => ({ path: legal.path, updated: legal.updated, priority: 0.3 }))
  ]

  return {
    plugins: [
      tailwindcss(),
      tanstackStart({
        pages: pages.map(({ path }) => ({ path })),
        prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false, failOnError: true },
        // The shell renders the root route alone, masked as a signed-in page: the landing's own path would be taken
        // as the page already prerendered.
        spa: { enabled: true, maskPath: "/home", prerender: { outputPath: "/_shell.html", crawlLinks: false } }
      }),
      viteReact(),
      crawlerFilesPlugin(crawlerFiles(site, pages))
    ],
    // The release analytics and telemetry report, as the server's (`npm_package_version` when built by pnpm).
    define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env["npm_package_version"] ?? "0.0.0") },
    server: { proxy: { "/api": server, "/auth": server } }
  }
})
