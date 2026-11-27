import { assert, describe, it } from "@effect/vitest"
import { stockViewSource, templatePath, templateUrl } from "../../../src/lib/pagePath.ts"

const origin = "https://paper.bluechip.markets"

describe("templatePath", () => {
  it.each([
    { name: "a page without ids", path: "/home", expected: "/home" },
    { name: "the landing page", path: "/", expected: "/" },
    {
      name: "an agent's tab",
      path: "/agents/agent_01jdxk4m2v8y9q5t3n7r6w0zab/journal",
      expected: "/agents/:id/journal"
    },
    { name: "a new agent keeps its word", path: "/agents/new", expected: "/agents/new" },
    { name: "an automation", path: "/automations/auto_01jdxk4m2v8y9q5t3n7r6w0zab", expected: "/automations/:id" },
    { name: "a conversation", path: "/chat/conversation_01jdxk4m2v8y9q5t3n7r6w0zab", expected: "/chat/:id" },
    { name: "a stock's symbol", path: "/stocks/NVDA", expected: "/stocks/:symbol" },
    { name: "the stock list", path: "/stocks", expected: "/stocks" },
    { name: "a UUID", path: "/x/0b9f1c3e-4a5d-4c6b-9e8f-7a6b5c4d3e2f", expected: "/x/:id" },
    { name: "an address", path: "/x/0x2a5bff0000000000000000000000000000000001", expected: "/x/:id" },
    { name: "a number", path: "/x/42", expected: "/x/:id" }
  ])("$name", ({ path, expected }) => {
    assert.strictEqual(templatePath(path), expected)
  })
})

describe("templateUrl", () => {
  it.each([
    {
      name: "a page with an id and a typed question",
      url: `${origin}/chat/conversation_01jdxk4m2v8y9q5t3n7r6w0zab?ask=sell+my+nvidia`,
      expected: `${origin}/chat/:id`
    },
    {
      name: "campaign tags are kept",
      url: `${origin}/?utm_source=x&utm_campaign=launch&ref=abc`,
      expected: `${origin}/?utm_source=x&utm_campaign=launch`
    },
    { name: "the hash is dropped", url: `${origin}/home#how`, expected: `${origin}/home` },
    { name: "another site's address", url: "https://news.example.com/a/42", expected: null },
    { name: "not an address", url: "not a url", expected: null }
  ])("$name", ({ url, expected }) => {
    assert.strictEqual(templateUrl(url, origin), expected)
  })
})

describe("stockViewSource", () => {
  it.each(
    [
      { name: "from home", previous: "/home", expected: "home" },
      { name: "from the stock list", previous: "/stocks", expected: "list" },
      { name: "from your holdings", previous: "/portfolio", expected: "list" },
      { name: "from an agent's page", previous: "/agents/agent_01jdxk4m2v8y9q5t3n7r6w0zab", expected: "agent" },
      { name: "from the assistant", previous: "/chat", expected: "search" },
      { name: "opened directly", previous: undefined, expected: "search" }
    ] as const
  )("$name", ({ previous, expected }) => {
    assert.strictEqual(stockViewSource(previous), expected)
  })
})
