import { assert, describe, it } from "@effect/vitest"
import { canonicalUrl, siteOf } from "../../../../src/lib/seo/site.ts"

const production = { origin: "https://bluechip.markets", indexed: true, name: "bluechip", paper: false }

describe("siteOf", () => {
  it.each(
    [
      {
        name: "production",
        network: "base",
        url: undefined,
        expected: { origin: "https://bluechip.markets", indexed: true, name: "bluechip", paper: false }
      },
      {
        name: "paper money",
        network: "sepolia",
        url: undefined,
        expected: { origin: "https://paper.bluechip.markets", indexed: false, name: "bluechip paper", paper: true }
      },
      {
        name: "the local chain",
        network: "local",
        url: undefined,
        expected: { origin: "http://localhost:3000", indexed: false, name: "bluechip", paper: false }
      },
      {
        name: "a configured URL, trimmed to its origin",
        network: "base",
        url: " https://preview.bluechip.markets/some/path/ ",
        expected: { origin: "https://preview.bluechip.markets", indexed: true, name: "bluechip", paper: false }
      },
      {
        name: "an empty configured URL falls back to the network's",
        network: "sepolia",
        url: "",
        expected: { origin: "https://paper.bluechip.markets", indexed: false, name: "bluechip paper", paper: true }
      }
    ] as const
  )("$name", ({ network, url, expected }) => {
    assert.deepStrictEqual(siteOf(network, url), expected)
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
