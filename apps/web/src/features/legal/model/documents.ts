/** A legal page: its title, where it lives, what search results say about it and the day it last changed. */
export interface LegalDocument {
  readonly title: string
  readonly path: "/legal/terms" | "/legal/privacy" | "/legal/risk"
  readonly description: string
  /** `2026-11-25`: the page's "Last updated" and the sitemap's `lastmod`. */
  readonly updated: string
}

export const TERMS: LegalDocument = {
  title: "Terms of use",
  path: "/legal/terms",
  description: "The terms of bluechip's early access: what bluechip is, who can use it, fees, and what you agree to.",
  updated: "2026-11-25"
}

export const PRIVACY: LegalDocument = {
  title: "Privacy policy",
  path: "/legal/privacy",
  description:
    "What bluechip keeps about you, why, and who else sees it. bluechip never asks for your name, email or phone number.",
  updated: "2026-11-27"
}

export const RISK: LegalDocument = {
  title: "Risk disclosure",
  path: "/legal/risk",
  description:
    "The risks of investing in tokenized US stocks onchain with software agents. Read this before you add cash.",
  updated: "2026-11-25"
}

export const LEGAL_DOCUMENTS: ReadonlyArray<LegalDocument> = [TERMS, PRIVACY, RISK]

/** "25 November 2026", as the page says it (the day itself, in no time zone). */
export const updatedText = (legal: LegalDocument): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${legal.updated}T00:00:00Z`))
