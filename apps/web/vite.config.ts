import { networks } from "@bluechip/chain/Network"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import * as Path from "node:path"
import { defineConfig, loadEnv, type Plugin } from "vite"
import {
  HELP_DESCRIPTION,
  helpArticle,
  helpGroups,
  helpSitemapPages,
  slugOf
} from "./src/features/help/model/articles.ts"
import { helpIndexMarkdown } from "./src/features/help/model/markdown.ts"
import { landingMarkdown } from "./src/features/landing/model/markdown.ts"
import { QUESTIONS } from "./src/features/landing/model/questions.ts"
import { LEGAL_DOCUMENTS, legalMarkdown } from "./src/features/legal/model/documents.ts"
import { crawlerFiles, type SitemapPage } from "./src/lib/seo/crawling.ts"
import { aiFiles } from "./src/lib/seo/llms.ts"
import { SITE_DESCRIPTION, siteOf } from "./src/lib/seo/site.ts"

const HELP = Path.join(import.meta.dirname, "../../content/help")

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
}

/** The day a help article last changed: its last commit, or the file's own date where there is no history (Docker). */
const updatedOf = (file: string): string => {
  try {
    const day = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { encoding: "utf8" }).trim()
    if (day !== "") return day
  } catch {
    // No git in the build (the image's context has no history): the file's date below.
  }
  return statSync(file).mtime.toISOString().slice(0, 10)
}

/**
 * `robots.txt`, `manifest.webmanifest`, on production `sitemap.xml`, and the files for agents (`llms.txt`,
 * `llms-full.txt`, each public page's Markdown twin) for this build's site: written beside the pages when it builds,
 * served by the development server.
 */
const crawlerFilesPlugin = (files: Readonly<Record<string, string>>): Plugin => ({
  name: "bluechip:crawler-files",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const file = files[request.url?.split("?")[0]?.slice(1) ?? ""]
      if (file === undefined) return next()
      const extension = Path.extname(request.url?.split("?")[0] ?? "")
      response.setHeader("Content-Type", CONTENT_TYPES[extension] ?? "text/plain; charset=utf-8")
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
  // In development (and the browser suite) the browser calls the server on the page's own origin, through this proxy;
  // a deployed build calls it on its own domain (VITE_API_URL).
  const server = env["SERVER_ORIGIN"] ?? "http://localhost:8080"
  const network = networks.find((candidate) => candidate === env["VITE_NETWORK"]) ?? "local"
  const site = siteOf(network, env["VITE_SITE_URL"], env["VITE_APP_URL"])

  const articles = readdirSync(HELP).filter((file) => file.endsWith(".md")).toSorted().map((file) =>
    helpArticle(slugOf(file), readFileSync(Path.join(HELP, file), "utf8"), updatedOf(Path.join(HELP, file)))
  )
  const groups = helpGroups(articles)

  // The public pages: prerendered to HTML with their head; every other path is the SPA shell. The landing changes
  // with each release, so its sitemap date is the build's; the help center's is its newest article's.
  const pages: ReadonlyArray<SitemapPage> = [
    { path: "/", updated: new Date().toISOString().slice(0, 10), priority: 1 },
    ...helpSitemapPages(groups),
    ...LEGAL_DOCUMENTS.map((legal) => ({ path: legal.path, updated: legal.updated, priority: 0.3 }))
  ]

  const agentFiles = aiFiles(site, {
    landing: {
      path: "/",
      title: "bluechip",
      description: SITE_DESCRIPTION,
      markdown: landingMarkdown(site, QUESTIONS)
    },
    help: { path: "/help", title: "Help", description: HELP_DESCRIPTION, markdown: helpIndexMarkdown(site, groups) },
    articles: groups.flatMap((group) => group.articles),
    legal: LEGAL_DOCUMENTS.map((legal) => ({ ...legal, markdown: legalMarkdown(legal) }))
  })

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
      crawlerFilesPlugin({ ...crawlerFiles(site, pages), ...agentFiles })
    ],
    // The release analytics and telemetry report, as the server's: the image's (its APP_VERSION build arg), else
    // `npm_package_version` when built by pnpm.
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(
        env["VITE_APP_VERSION"] || process.env["npm_package_version"] || "0.0.0"
      ),
      // Each help article's date, for its page's structured data (`features/help/model/content.ts`).
      "import.meta.env.VITE_HELP_UPDATED": JSON.stringify(
        Object.fromEntries(articles.map((article) => [article.slug, article.updated]))
      )
    },
    server: { proxy: { "/api": server, "/auth": server } }
  }
})
