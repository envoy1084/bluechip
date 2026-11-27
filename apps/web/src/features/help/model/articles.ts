// Pure, without this build's environment: the Vite config reads the articles with it to list them in the sitemap and
// write their Markdown twins (`content.ts` is the app's own copy, bundled from the same files).
import { anchorOf, parseArticle } from "@bluechip/domain/knowledge/Knowledge"
import type { SitemapPage } from "../../../lib/seo/crawling.ts"
import type { SocialImage } from "../../../lib/seo/head.ts"

/** A run of an article's text: help articles are plain paragraphs and `- ` lists, no inline Markdown. */
export type HelpBlock =
  | { readonly _tag: "Paragraph"; readonly text: string }
  | { readonly _tag: "List"; readonly items: ReadonlyArray<string> }

/** A `## Heading` and what follows it; its anchor is the fragment the assistant's citations link to. */
export interface HelpSection {
  readonly heading: string
  readonly anchor: string
  readonly blocks: ReadonlyArray<HelpBlock>
}

/** A help article, `content/help/<slug>.md`, published at `/help/<slug>`. */
export interface HelpArticle {
  readonly slug: string
  readonly path: string
  readonly title: string
  /** The first paragraph, cut to whole sentences for search results. */
  readonly description: string
  /** Text before the first heading, if any. */
  readonly intro: ReadonlyArray<HelpBlock>
  readonly sections: ReadonlyArray<HelpSection>
  /** The file as written: the page's Markdown twin. */
  readonly markdown: string
  /** The day it last changed, `2026-11-27`: the sitemap's `lastmod` and the article's `dateModified`. */
  readonly updated: string
}

/** Paragraphs and lists, split at blank lines; a line that continues a list item or paragraph joins it. */
export const blocksOf = (text: string): ReadonlyArray<HelpBlock> =>
  text.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0).map((chunk): HelpBlock => {
    const lines = chunk.split("\n").map((line) => line.trim())
    if (!lines[0]!.startsWith("- ")) return { _tag: "Paragraph", text: lines.join(" ") }

    const items: Array<string> = []
    for (const line of lines) {
      if (line.startsWith("- ")) items.push(line.slice(2).trim())
      else items[items.length - 1] = `${items[items.length - 1]} ${line}`
    }
    return { _tag: "List", items }
  })

const DESCRIPTION_LENGTH = 200

/** Whole sentences of a paragraph up to a search result's length, and always at least the first. */
export const descriptionOf = (paragraph: string): string => {
  if (paragraph.length <= DESCRIPTION_LENGTH) return paragraph

  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [paragraph]
  let description = sentences[0]!.trim()
  for (const sentence of sentences.slice(1)) {
    const longer = `${description} ${sentence.trim()}`
    if (longer.length > DESCRIPTION_LENGTH) break
    description = longer
  }
  return description
}

/** An article from its file: the title, sections with their anchors, and its description. */
export const helpArticle = (slug: string, markdown: string, updated: string): HelpArticle => {
  const parsed = parseArticle(markdown)
  const intro = parsed.sections.filter((section) => section.heading === null).flatMap((section) =>
    blocksOf(section.text)
  )
  const sections = parsed.sections.flatMap((section) =>
    section.heading === null ?
      [] :
      [{ heading: section.heading, anchor: anchorOf(section.heading), blocks: blocksOf(section.text) }]
  )
  const first = [...intro, ...sections.flatMap((section) => section.blocks)].find((block) => block._tag === "Paragraph")
  return {
    slug,
    path: `/help/${slug}`,
    title: parsed.title,
    description: first?._tag === "Paragraph" ? descriptionOf(first.text) : parsed.title,
    intro,
    sections,
    markdown,
    updated
  }
}

/** `content/help/recovery.md` is `recovery`. */
export const slugOf = (file: string): string => file.replace(/^.*\//, "").replace(/\.md$/, "")

/** A shelf of the help center: its articles in reading order, and the social image their pages share. */
export interface HelpGroup {
  readonly title: string
  readonly image: SocialImage
  readonly articles: ReadonlyArray<HelpArticle>
}

const GROUPS: ReadonlyArray<{ readonly title: string; readonly image: SocialImage; readonly slugs: Array<string> }> = [
  { title: "Getting started", image: "default", slugs: ["getting-started", "paper-money", "funding", "gas"] },
  {
    title: "Agents and trading",
    image: "agents",
    slugs: ["agents", "policies", "approvals", "trading", "automations"]
  },
  { title: "The assistant", image: "assistant", slugs: ["assistant", "memory", "telegram"] },
  { title: "Your account", image: "safety", slugs: ["portfolio", "notifications", "recovery", "privacy"] }
]

/** The articles on their shelves; one no shelf names is under More, by title, so a new article is never left out. */
export const helpGroups = (articles: ReadonlyArray<HelpArticle>): ReadonlyArray<HelpGroup> => {
  const shelved = GROUPS.map((group) => ({
    title: group.title,
    image: group.image,
    articles: group.slugs.flatMap((slug) => articles.filter((article) => article.slug === slug))
  }))
  const named = new Set(GROUPS.flatMap((group) => group.slugs))
  const more = articles.filter((article) => !named.has(article.slug))
    .toSorted((a, b) => a.title.localeCompare(b.title))
  return [...shelved, { title: "More", image: "default" as const, articles: more }]
    .filter((group) => group.articles.length > 0)
}

/** The articles before and after one, in the help center's reading order. */
export const neighboursOf = (groups: ReadonlyArray<HelpGroup>, slug: string): {
  readonly previous: HelpArticle | undefined
  readonly next: HelpArticle | undefined
} => {
  const ordered = groups.flatMap((group) => group.articles)
  const at = ordered.findIndex((article) => article.slug === slug)
  return at === -1 ?
    { previous: undefined, next: undefined } :
    { previous: ordered[at - 1], next: ordered[at + 1] }
}

/** The group an article sits in. */
export const groupOf = (groups: ReadonlyArray<HelpGroup>, slug: string): HelpGroup | undefined =>
  groups.find((group) => group.articles.some((article) => article.slug === slug))

/** The help center in the sitemap: its index, dated by its newest article, then every article on a shelf. */
export const helpSitemapPages = (groups: ReadonlyArray<HelpGroup>): ReadonlyArray<SitemapPage> => {
  const articles = groups.flatMap((group) => group.articles)
  const newest = articles.map((article) => article.updated).toSorted().at(-1)
  return [
    ...(newest === undefined ? [] : [{ path: "/help", updated: newest, priority: 0.6 }]),
    ...articles.map((article) => ({ path: article.path, updated: article.updated, priority: 0.5 }))
  ]
}

/** What the help center's index says under its title. */
export const HELP_DESCRIPTION =
  "How bluechip works: your account and passkeys, agents and their rules, automations, the assistant, cash and recovery."
