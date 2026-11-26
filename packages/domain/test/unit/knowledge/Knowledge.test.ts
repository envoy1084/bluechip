import { anchorOf, describeStockFacts, parseArticle } from "@bluechip/domain/knowledge/Knowledge"
import { assert, describe, it } from "@effect/vitest"

describe("parseArticle", () => {
  it.each([
    {
      name: "a title and two sections",
      markdown: "# Gas\n\n## Who pays\n\nYou do.\n\n## Budget\n\nA cap\na day.\n",
      expected: {
        title: "Gas",
        sections: [{ heading: "Who pays", text: "You do." }, { heading: "Budget", text: "A cap\na day." }]
      }
    },
    {
      name: "text before the first heading is a section without one",
      markdown: "# Gas\n\nIn short.\n\n## Who pays\n\nYou do.",
      expected: {
        title: "Gas",
        sections: [{ heading: null, text: "In short." }, { heading: "Who pays", text: "You do." }]
      }
    },
    {
      name: "a blank section is left out",
      markdown: "# Gas\n\n## Empty\n\n## Who pays\nYou do.",
      expected: { title: "Gas", sections: [{ heading: "Who pays", text: "You do." }] }
    },
    {
      name: "Windows line ends",
      markdown: "# Gas\r\n## Who pays\r\nYou do.\r\n",
      expected: { title: "Gas", sections: [{ heading: "Who pays", text: "You do." }] }
    },
    {
      name: "no title",
      markdown: "Just text.",
      expected: { title: "", sections: [{ heading: null, text: "Just text." }] }
    },
    { name: "nothing", markdown: "", expected: { title: "", sections: [] } }
  ])("$name", ({ expected, markdown }) => {
    assert.deepStrictEqual(parseArticle(markdown), expected)
  })
})

describe("anchorOf", () => {
  it.each([
    { heading: "Locking it with Face ID", expected: "locking-it-with-face-id" },
    { heading: "What's an agent?", expected: "what-s-an-agent" },
    { heading: "  Gas  ", expected: "gas" }
  ])("$heading", ({ expected, heading }) => {
    assert.strictEqual(anchorOf(heading), expected)
  })
})

describe("describeStockFacts", () => {
  it("a stock without a pool says bluechip can't trade it", () => {
    assert.strictEqual(
      describeStockFacts({ symbol: "COIN", name: "Coinbase", token: "0x01", feed: "0x02", pool: null }),
      "Coinbase (COIN) is one of Coinbase's tokenized stocks on Base; its token is 0x01. bluechip prices it with " +
        "Chainlink's NAV feed at 0x02, and checks every trade's price against it. It has no pool to trade in, so " +
        "bluechip can't trade it."
    )
  })
})
