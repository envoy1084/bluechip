import { assert, describe, it } from "@effect/vitest"
import { aiFiles, llmsFullTxt, llmsTxt } from "../../../../src/lib/seo/llms.ts"
import { SITE_DESCRIPTION } from "../../../../src/lib/seo/site.ts"
import { LOCAL, PAPER, PRODUCTION } from "../../../fixtures/Help.ts"

const pages = {
  landing: { path: "/", title: "bluechip", description: "Agents in limits.", markdown: "# bluechip\n\nAgents.\n" },
  help: { path: "/help", title: "Help", description: "How it works.", markdown: "# bluechip help\n\nArticles.\n" },
  articles: [{ path: "/help/gas", title: "Gas", description: "Who pays.", markdown: "# Gas\n\n## Who pays\n\nYou.\n" }],
  legal: [{ path: "/legal/risk", title: "Risk disclosure", description: "The risks.", markdown: "# Risk\n\nRisks.\n" }]
}

describe("llmsTxt", () => {
  it("production: what bluechip is, then every page linked to its Markdown, by section", () => {
    assert.strictEqual(
      llmsTxt(PRODUCTION, pages),
      [
        "# bluechip",
        "",
        `> ${SITE_DESCRIPTION}`,
        "",
        "bluechip is a web app at its own site: you sign in with a passkey (Face ID), hold USDC and Coinbase's " +
        "tokenized US stocks in a smart account on Base, and hire AI agents whose limits are enforced onchain. It is " +
        "not available to people in the United States, and nothing on it is investment advice. Every page below is " +
        "plain Markdown; https://bluechip.markets/llms-full.txt has all of them in one file.",
        "",
        "## Product",
        "",
        "- [bluechip](https://bluechip.markets/index.md): Agents in limits.",
        "- [Help](https://bluechip.markets/help.md): How it works.",
        "",
        "## Help",
        "",
        "- [Gas](https://bluechip.markets/help/gas.md): Who pays.",
        "",
        "## Legal",
        "",
        "- [Risk disclosure](https://bluechip.markets/legal/risk.md): The risks.",
        "",
        "## Optional",
        "",
        "- [Get started](https://bluechip.markets/welcome): create an account with a passkey, in a browser",
        "- [Everything in one file](https://bluechip.markets/llms-full.txt): the overview, every help article and the legal pages",
        ""
      ].join("\n")
    )
  })

  it("paper money says it's test money and where real money is", () => {
    assert.include(
      llmsTxt(PAPER, pages),
      "# bluechip paper\n\n" +
        `> ${SITE_DESCRIPTION}\n\n` +
        "This is bluechip paper money: the same app on Base Sepolia, Base's test network, with test USDC worth nothing.\n" +
        "Real money is at https://bluechip.markets.\n"
    )
  })

  it("the landing sending to paper money says the beta is paper money, and starts there", () => {
    const text = llmsTxt({ ...PRODUCTION, app: "https://paper.bluechip.markets" }, pages)
    assert.deepStrictEqual(
      [
        text.includes(
          "bluechip is in open beta on paper money, at https://paper.bluechip.markets/: the same app on Base Sepolia, " +
            "Base's test network, with test USDC worth nothing, so nothing real is at stake.\n"
        ),
        text.includes("- [Get started](https://paper.bluechip.markets/welcome): create an account with a passkey")
      ],
      [true, true]
    )
  })

  it("a local build says it's one, and links its own origin", () => {
    const text = llmsTxt(LOCAL, pages)
    assert.deepStrictEqual(
      [
        text.includes("This is a local development build of bluechip. The public site is https://bluechip.markets."),
        text.includes("- [Gas](http://localhost:3000/help/gas.md): Who pays.")
      ],
      [true, true]
    )
  })
})

describe("llmsFullTxt", () => {
  it("the landing, the articles and the legal pages, whole, each with its source under its title", () => {
    assert.strictEqual(
      llmsFullTxt(PRODUCTION, pages),
      [
        "# bluechip",
        "",
        "Source: https://bluechip.markets/",
        "",
        "Agents.",
        "",
        "# Gas",
        "",
        "Source: https://bluechip.markets/help/gas",
        "",
        "## Who pays",
        "",
        "You.",
        "",
        "# Risk",
        "",
        "Source: https://bluechip.markets/legal/risk",
        "",
        "Risks.",
        ""
      ].join("\n")
    )
  })
})

describe("aiFiles", () => {
  it("llms.txt, llms-full.txt and a Markdown twin beside every page", () => {
    assert.deepStrictEqual(Object.keys(aiFiles(PRODUCTION, pages)), [
      "llms.txt",
      "llms-full.txt",
      "index.md",
      "help.md",
      "help/gas.md",
      "legal/risk.md"
    ])
  })

  it("a twin is the page's Markdown, ending in one newline", () => {
    assert.strictEqual(aiFiles(PRODUCTION, pages)["help/gas.md"], "# Gas\n\n## Who pays\n\nYou.\n")
  })
})
