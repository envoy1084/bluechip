import { assert, describe, it } from "@effect/vitest"
import { jsonLdScript, pageHead, pageTitle } from "../../../../src/lib/seo/head.ts"
import { SITE_DESCRIPTION } from "../../../../src/lib/seo/site.ts"

const production = { origin: "https://bluechip.markets", indexed: true, name: "bluechip", paper: false, app: null }
const paper = {
  origin: "https://paper.bluechip.markets",
  indexed: false,
  name: "bluechip paper",
  paper: true,
  app: null
}

describe("pageTitle", () => {
  it("a page's name, then the site's", () => {
    assert.strictEqual(pageTitle("Portfolio", production), "Portfolio | bluechip")
  })

  it("paper money names itself", () => {
    assert.strictEqual(pageTitle("Apple", paper), "Apple | bluechip paper")
  })

  it("no page name is the site's name alone", () => {
    assert.strictEqual(pageTitle(undefined, production), "bluechip")
  })
})

describe("pageHead", () => {
  it("a signed-in page: its title everywhere, no canonical URL and no robots of its own", () => {
    assert.deepStrictEqual(pageHead({ title: "Portfolio" }, production), {
      meta: [
        { title: "Portfolio | bluechip" },
        { name: "description", content: SITE_DESCRIPTION },
        { property: "og:title", content: "Portfolio | bluechip" },
        { property: "og:description", content: SITE_DESCRIPTION },
        { name: "twitter:title", content: "Portfolio | bluechip" },
        { name: "twitter:description", content: SITE_DESCRIPTION }
      ],
      links: []
    })
  })

  it("a public page on production: its image, canonical URL and indexed", () => {
    assert.deepStrictEqual(
      pageHead(
        { title: "Terms of use", description: "The terms.", path: "/legal/terms", image: "legal" },
        production
      ),
      {
        meta: [
          { title: "Terms of use | bluechip" },
          { name: "description", content: "The terms." },
          { property: "og:title", content: "Terms of use | bluechip" },
          { property: "og:description", content: "The terms." },
          { name: "twitter:title", content: "Terms of use | bluechip" },
          { name: "twitter:description", content: "The terms." },
          { property: "og:image", content: "https://bluechip.markets/og/legal.png" },
          { property: "og:image:alt", content: "bluechip's terms, privacy policy and risk disclosure" },
          { name: "twitter:image", content: "https://bluechip.markets/og/legal.png" },
          { name: "twitter:image:alt", content: "bluechip's terms, privacy policy and risk disclosure" },
          { property: "og:url", content: "https://bluechip.markets/legal/terms" },
          {
            name: "robots",
            content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
          }
        ],
        links: [{ rel: "canonical", href: "https://bluechip.markets/legal/terms" }]
      }
    )
  })

  it("a public page on paper money: the paper image, and never indexed", () => {
    assert.deepStrictEqual(pageHead({ fullTitle: "bluechip paper | Try it", path: "/", image: "default" }, paper), {
      meta: [
        { title: "bluechip paper | Try it" },
        { name: "description", content: SITE_DESCRIPTION },
        { property: "og:title", content: "bluechip paper | Try it" },
        { property: "og:description", content: SITE_DESCRIPTION },
        { name: "twitter:title", content: "bluechip paper | Try it" },
        { name: "twitter:description", content: SITE_DESCRIPTION },
        { property: "og:image", content: "https://paper.bluechip.markets/og/paper.png" },
        { property: "og:image:alt", content: "bluechip paper money: practise with test USDC" },
        { name: "twitter:image", content: "https://paper.bluechip.markets/og/paper.png" },
        { name: "twitter:image:alt", content: "bluechip paper money: practise with test USDC" },
        { property: "og:url", content: "https://paper.bluechip.markets/" },
        { name: "robots", content: "noindex, nofollow" }
      ],
      links: [{ rel: "canonical", href: "https://paper.bluechip.markets/" }]
    })
  })

  it("a page with a Markdown twin links it beside its canonical URL", () => {
    assert.deepStrictEqual(pageHead({ title: "Gas", path: "/help/gas", markdown: true }, production).links, [
      { rel: "canonical", href: "https://bluechip.markets/help/gas" },
      { rel: "alternate", type: "text/markdown", href: "https://bluechip.markets/help/gas.md" }
    ])
  })

  it("the landing's twin is /index.md", () => {
    assert.deepStrictEqual(pageHead({ path: "/", markdown: true }, production).links[1], {
      rel: "alternate",
      type: "text/markdown",
      href: "https://bluechip.markets/index.md"
    })
  })
})

describe("jsonLdScript", () => {
  it("JSON that can't close its script or start markup, and parses back the same", () => {
    const data = { name: "</script><b>A & B</b>\u2028" }
    const script = jsonLdScript(data)

    assert.deepStrictEqual(script, {
      type: "application/ld+json",
      children: String.raw`{"name":"\u003c/script\u003e\u003cb\u003eA \u0026 B\u003c/b\u003e\u2028"}`
    })
    assert.deepStrictEqual(JSON.parse(script.children), data)
  })
})
