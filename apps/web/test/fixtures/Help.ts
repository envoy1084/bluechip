// Help articles and sites as the help center and the AI files read them.
import { type HelpArticle, helpArticle } from "../../src/features/help/model/articles.ts"

export const PRODUCTION = {
  origin: "https://bluechip.markets",
  indexed: true,
  name: "bluechip",
  paper: false,
  app: null
}
export const PAPER = {
  origin: "https://paper.bluechip.markets",
  indexed: false,
  name: "bluechip paper",
  paper: true,
  app: null
}
export const LOCAL = { origin: "http://localhost:3000", indexed: false, name: "bluechip", paper: false, app: null }

/** A one-section article, `# <title>` then `## About` and `Text.`, last changed on 27 November 2026 unless told. */
export const articleOf = (slug: string, title: string, updated = "2026-11-27"): HelpArticle =>
  helpArticle(slug, `# ${title}\n\n## About\n\nText.\n`, updated)
