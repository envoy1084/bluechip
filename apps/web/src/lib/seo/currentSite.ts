import { network } from "../network.ts"
import { type Site, siteOf } from "./site.ts"

/** This build's site. */
export const site: Site = siteOf(network, import.meta.env["VITE_SITE_URL"], import.meta.env["VITE_APP_URL"])
