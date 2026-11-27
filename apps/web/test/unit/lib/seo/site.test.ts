import { assert, describe, it } from "@effect/vitest"
import { appPageUrl, canonicalUrl, sendsToPaper, siteOf } from "../../../../src/lib/seo/site.ts"

const production = { origin: "https://bluechip.markets", indexed: true, name: "bluechip", paper: false, app: null }

describe("siteOf", () => {
  it.each(
    [
      {
        name: "production",
        network: "base",
        url: undefined,
        expected: { origin: "https://bluechip.markets", indexed: true, name: "bluechip", paper: false, app: null }
      },
      {
        name: "paper money",
        network: "sepolia",
        url: undefined,
        expected: {
          origin: "https://paper.bluechip.markets",
          indexed: false,
          name: "bluechip paper",
          paper: true,
          app: null
        }
      },
      {
        name: "the local chain",
        network: "local",
        url: undefined,
        expected: { origin: "http://localhost:3000", indexed: false, name: "bluechip", paper: false, app: null }
      },
      {
        name: "a configured URL, trimmed to its origin",
        network: "base",
        url: " https://preview.bluechip.markets/some/path/ ",
        expected: {
          origin: "https://preview.bluechip.markets",
          indexed: true,
          name: "bluechip",
          paper: false,
          app: null
        }
      },
      {
        name: "an empty configured URL falls back to the network's",
        network: "sepolia",
        url: "",
        expected: {
          origin: "https://paper.bluechip.markets",
          indexed: false,
          name: "bluechip paper",
          paper: true,
          app: null
        }
      }
    ] as const
  )("$name", ({ network, url, expected }) => {
    assert.deepStrictEqual(siteOf(network, url), expected)
  })

  it("the landing alone: the app's URL, trimmed to its origin", () => {
    assert.deepStrictEqual(siteOf("base", "https://bluechip.markets", " https://paper.bluechip.markets/ "), {
      origin: "https://bluechip.markets",
      indexed: true,
      name: "bluechip",
      paper: false,
      app: "https://paper.bluechip.markets"
    })
  })

  it("an empty app URL: the app is on this site", () => {
    assert.strictEqual(siteOf("base", undefined, "").app, null)
  })
})

const landing = { ...production, app: "https://paper.bluechip.markets" }

describe("appPageUrl", () => {
  it("the app on this site: the path on its origin", () => {
    assert.strictEqual(appPageUrl("/welcome", production), "https://bluechip.markets/welcome")
  })

  it("the landing alone: the path on the app's site", () => {
    assert.strictEqual(appPageUrl("/welcome", landing), "https://paper.bluechip.markets/welcome")
  })
})

describe("sendsToPaper", () => {
  it.each(
    [
      { name: "the app on this site", site: production, expected: false },
      { name: "a landing sending to paper money", site: landing, expected: true },
      {
        name: "a landing sending to another app",
        site: { ...production, app: "https://app.bluechip.markets" },
        expected: false
      },
      {
        name: "paper only as a word in the host",
        site: { ...production, app: "https://newspaper.example.com" },
        expected: false
      }
    ] as const
  )("$name", ({ site, expected }) => {
    assert.strictEqual(sendsToPaper(site), expected)
  })
})

describe("canonicalUrl", () => {
  it("the landing is the origin with its slash", () => {
    assert.strictEqual(canonicalUrl("/", production), "https://bluechip.markets/")
  })

  it("a page is its path on the origin", () => {
    assert.strictEqual(canonicalUrl("/legal/terms", production), "https://bluechip.markets/legal/terms")
  })
})
