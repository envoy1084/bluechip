// Pure, without this build's environment: the Vite config imports it to write robots.txt, the sitemap and the
// manifest (`currentSite.ts` is the build's own site).
import type { Network } from "@bluechip/chain/Network"

/** The deployment as search engines and link previews see it. */
export interface Site {
  /** The site's origin, without a trailing slash: canonical URLs, images and the sitemap start with it. */
  readonly origin: string
  /** Only production is indexed: paper money and the local chain never compete with it in search. */
  readonly indexed: boolean
  /** The name after every title's `|`: paper money says so in every tab. */
  readonly name: string
  /** The paper money site: test USDC on Base Sepolia. */
  readonly paper: boolean
}

const ORIGINS: Readonly<Record<Network, string>> = {
  base: "https://bluechip.markets",
  sepolia: "https://paper.bluechip.markets",
  local: "http://localhost:3000"
}

/** The site of a build: its network, and `VITE_SITE_URL` when it is served somewhere else (a preview deployment). */
export const siteOf = (network: Network, configuredUrl: string | undefined): Site => {
  const configured = configuredUrl?.trim()
  const origin = configured === undefined || configured === "" ? ORIGINS[network] : new URL(configured).origin
  return {
    origin,
    indexed: network === "base",
    name: network === "sepolia" ? "bluechip paper" : "bluechip",
    paper: network === "sepolia"
  }
}

/** A path's absolute URL on the site: `/` is the origin itself. */
export const canonicalUrl = (path: string, site: Site): string =>
  path === "/" ? `${site.origin}/` : `${site.origin}${path}`

/** The brand, as every page and card names it. */
export const BRAND = "bluechip"

/** What bluechip is, in one sentence: the default description of every page. */
export const SITE_DESCRIPTION =
  "AI agents trade tokenized US stocks on Base inside limits you set and lock with Face ID. Base enforces them on every trade, checked against Chainlink."

/** What people search for when they look for bluechip. */
export const SITE_KEYWORDS = [
  "AI trading agents",
  "tokenized stocks",
  "US stocks onchain",
  "Base",
  "trading limits",
  "passkeys",
  "Chainlink prices",
  "USDC",
  "trading automations",
  "AI investing assistant"
]
