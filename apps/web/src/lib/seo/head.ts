import { site as currentSite } from "./currentSite.ts"
import { BRAND, canonicalUrl, type Site, SITE_DESCRIPTION, SITE_KEYWORDS } from "./site.ts"

/** The social images in `public/og/`, each 1200×630, rendered by `node scripts/bin.ts og`. */
export type SocialImage = "default" | "legal" | "agents" | "automations" | "assistant" | "safety"

const IMAGE_ALT: Readonly<Record<SocialImage | "paper", string>> = {
  default: "bluechip: agents trade stocks, you set the limits",
  legal: "bluechip's terms, privacy policy and risk disclosure",
  agents: "bluechip: hire an agent and set its limits",
  automations: "bluechip automations: say when, it does the rest",
  assistant: "bluechip's assistant, in the app and in Telegram",
  safety: "bluechip: your account answers only to you",
  paper: "bluechip paper money: practise with test USDC"
}

/** A page's head: what its tab, search results and link previews say. */
export interface Page {
  /** The page's name before `| bluechip`; none for the landing's own title. */
  readonly title?: string
  /** The landing's title, written whole (it leads with the brand). */
  readonly fullTitle?: string
  readonly description?: string
  /** A public page's path: it gets a canonical URL and is indexed where the site is. Signed-in pages have none. */
  readonly path?: string
  readonly image?: SocialImage
}

type Meta =
  | { readonly title: string }
  | { readonly name: string; readonly content: string }
  | { readonly property: string; readonly content: string }

type Link = { readonly rel: string; readonly href: string }

/** `Portfolio | bluechip`, or the site's name alone. */
export const pageTitle = (title: string | undefined, site: Site = currentSite): string =>
  title === undefined ? site.name : `${title} | ${site.name}`

/** Every paper money page shares the paper card, so a preview always says it's test money. */
const imageOf = (image: SocialImage, site: Site) => site.paper ? "paper" : image

/**
 * The meta and links of a page, to return from a route's `head()`. The root route's defaults fill in what a page
 * leaves out; a page with a `path` also says whether it may be indexed (the root says no to everything else).
 */
export const pageHead = (
  page: Page,
  site: Site = currentSite
): { meta: Array<Meta>; links: Array<Link> } => {
  const title = page.fullTitle ?? pageTitle(page.title, site)
  const description = page.description ?? SITE_DESCRIPTION
  const meta: Array<Meta> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description }
  ]

  if (page.image !== undefined) {
    const image = imageOf(page.image, site)
    meta.push(
      { property: "og:image", content: `${site.origin}/og/${image}.png` },
      { property: "og:image:alt", content: IMAGE_ALT[image] },
      { name: "twitter:image", content: `${site.origin}/og/${image}.png` },
      { name: "twitter:image:alt", content: IMAGE_ALT[image] }
    )
  }

  if (page.path === undefined) return { meta, links: [] }

  const url = canonicalUrl(page.path, site)
  meta.push(
    { property: "og:url", content: url },
    { name: "robots", content: site.indexed ? INDEXED : NOT_INDEXED }
  )
  return { meta, links: [{ rel: "canonical", href: url }] }
}

const INDEXED = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
const NOT_INDEXED = "noindex, nofollow"

/** The root route's head: what every page shares, and the defaults a page's own head overrides. */
export const siteHead = (site: Site = currentSite) => ({
  meta: [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ...pageHead({ image: "default" }, site).meta,
    { name: "robots", content: NOT_INDEXED },
    { name: "keywords", content: SITE_KEYWORDS.join(", ") },
    { name: "author", content: BRAND },
    { name: "publisher", content: BRAND },
    { name: "application-name", content: site.name },
    { name: "apple-mobile-web-app-title", content: site.name },
    { name: "apple-mobile-web-app-capable", content: "yes" },
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    { name: "theme-color", content: "#ffffff" },
    { name: "color-scheme", content: "light" },
    { name: "format-detection", content: "telephone=no, date=no, email=no, address=no" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND },
    { property: "og:locale", content: "en_GB" },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" }
  ],
  links: [
    { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
    { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    { rel: "manifest", href: "/manifest.webmanifest" }
  ]
})

/**
 * A JSON-LD `<script>` for a route's `head().scripts`. The JSON is escaped so no value (an answer, a name) can close
 * the script or start markup: `<`, `>`, `&` and the line separators become `\u` escapes, which JSON reads the same.
 */
export const jsonLdScript = (data: unknown): { type: string; children: string } => ({
  type: "application/ld+json",
  children: JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  )
})
