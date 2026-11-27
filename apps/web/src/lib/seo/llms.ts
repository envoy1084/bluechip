import { appPageUrl, canonicalUrl, markdownPath, sendsToPaper, type Site, SITE_DESCRIPTION } from "./site.ts"

/** A public page as agents read it: where it is, what it is in a line, and the whole page in Markdown. */
export interface MarkdownPage {
  readonly path: string
  readonly title: string
  readonly description: string
  /** The page in Markdown, starting with its `# Title`. */
  readonly markdown: string
}

/** The public pages the AI files list: the landing, the help center's index and articles, and the legal pages. */
export interface PublicPages {
  readonly landing: MarkdownPage
  readonly help: MarkdownPage
  readonly articles: ReadonlyArray<MarkdownPage>
  readonly legal: ReadonlyArray<MarkdownPage>
}

/** What this site is, for a reader that lands on paper money or a local build instead of production. */
const siteNote = (site: Site): ReadonlyArray<string> => {
  if (sendsToPaper(site)) {
    return [
      `bluechip is in open beta on paper money, at ${appPageUrl("/", site)}: the same app on Base Sepolia, Base's ` +
      "test network, with test USDC worth nothing, so nothing real is at stake.",
      ""
    ]
  }
  if (site.indexed) return []
  if (site.paper) {
    return [
      "This is bluechip paper money: the same app on Base Sepolia, Base's test network, with test USDC worth nothing.",
      "Real money is at https://bluechip.markets.",
      ""
    ]
  }
  return ["This is a local development build of bluechip. The public site is https://bluechip.markets.", ""]
}

const entry = (site: Site, page: MarkdownPage) =>
  `- [${page.title}](${canonicalUrl(markdownPath(page.path), site)}): ${page.description}`

/**
 * `/llms.txt` (llmstxt.org): what bluechip is, then every public page as a link to its Markdown twin with a line on
 * what it says. The Optional section is what an agent can skip on a short context.
 */
export const llmsTxt = (site: Site, pages: PublicPages): string =>
  [
    `# ${site.name}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    ...siteNote(site),
    "bluechip is a web app at its own site: you sign in with a passkey (Face ID), hold USDC and Coinbase's tokenized US " +
    "stocks in a smart account on Base, and hire AI agents whose limits are enforced onchain. It is not available to " +
    "people in the United States, and nothing on it is investment advice. Every page below is plain Markdown; " +
    `${canonicalUrl("/llms-full.txt", site)} has all of them in one file.`,
    "",
    "## Product",
    "",
    entry(site, pages.landing),
    entry(site, pages.help),
    "",
    "## Help",
    "",
    ...pages.articles.map((page) => entry(site, page)),
    "",
    "## Legal",
    "",
    ...pages.legal.map((page) => entry(site, page)),
    "",
    "## Optional",
    "",
    `- [Get started](${appPageUrl("/welcome", site)}): create an account with a passkey, in a browser`,
    `- [Everything in one file](${
      canonicalUrl("/llms-full.txt", site)
    }): the overview, every help article and the legal pages`,
    ""
  ].join("\n")

/** A page in the full file: its Markdown, with its address under the title so a quote can be cited. */
const section = (site: Site, page: MarkdownPage) => {
  const [title, ...rest] = page.markdown.trim().split("\n")
  return [title, "", `Source: ${canonicalUrl(page.path, site)}`, ...rest, ""].join("\n")
}

/** `/llms-full.txt`: the product overview, every help article and the legal pages, whole, in one Markdown file. */
export const llmsFullTxt = (site: Site, pages: PublicPages): string =>
  [
    section(site, pages.landing),
    ...pages.articles.map((page) => section(site, page)),
    ...pages.legal.map((page) => section(site, page))
  ].join("\n")

/** The files for agents, by name beside the pages: `llms.txt`, `llms-full.txt` and every page's Markdown twin. */
export const aiFiles = (site: Site, pages: PublicPages): Readonly<Record<string, string>> =>
  Object.fromEntries([
    ["llms.txt", llmsTxt(site, pages)],
    ["llms-full.txt", llmsFullTxt(site, pages)],
    ...[pages.landing, pages.help, ...pages.articles, ...pages.legal].map((page) => [
      markdownPath(page.path).slice(1),
      page.markdown.trim() + "\n"
    ])
  ])
