import { type HelpArticle, helpArticle, helpGroups, slugOf } from "./articles.ts"

// The help center's files, bundled as text; the Vite config dates each from git (`VITE_HELP_UPDATED`).
const FILES = import.meta.glob<string>("../../../../../../content/help/*.md", {
  query: "?raw",
  import: "default",
  eager: true
})

const UPDATED: Readonly<Record<string, string>> = import.meta.env["VITE_HELP_UPDATED"] ?? {}

/** Every help article, published at `/help/<slug>`. */
export const HELP_ARTICLES: ReadonlyArray<HelpArticle> = Object.entries(FILES).map(([file, markdown]) => {
  const slug = slugOf(file)
  return helpArticle(slug, markdown, UPDATED[slug] ?? "")
})

/** The articles on the help center's shelves, in reading order. */
export const HELP_GROUPS = helpGroups(HELP_ARTICLES)
