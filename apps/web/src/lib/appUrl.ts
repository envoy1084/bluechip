// Until mainnet, bluechip.markets is the landing alone (`VITE_APP_URL`) and the app is paper money's
// (paper.bluechip.markets): every way into the app leaves for the app's site, and the landing calls no API.
import { site } from "./seo/currentSite.ts"

/** A page of the app as a link: its path when the app is on this site, its URL on the app's site otherwise. */
export const appHrefOf = (app: string | null, path: string): string => app === null ? path : `${app}${path}`

/** The landing's own pages, the ones it prerenders: everything else is the app. */
export const isLandingPath = (pathname: string): boolean =>
  pathname === "/" || pathname === "/help" || pathname.startsWith("/help/") || pathname.startsWith("/legal/")

/**
 * Where a page of the landing-only site sends its visitor: the same path, query and hash on the app's site, or `null`
 * when it is one of the landing's own pages (or the app is on this site).
 */
export const appRedirectOf = (
  app: string | null,
  location: { readonly pathname: string; readonly search: string; readonly hash: string }
): string | null => {
  if (app === null || isLandingPath(location.pathname)) return null
  return `${app}${location.pathname}${location.search}${location.hash}`
}

/** This build is the landing alone: no API, no app, and the app on another site. */
export const landingOnly: boolean = site.app !== null

/** A page of the app as this build links to it. */
export const appHref = (path: string): string => appHrefOf(site.app, path)
