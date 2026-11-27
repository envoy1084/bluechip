import { assert, describe, it } from "@effect/vitest"
import { helpGroups } from "../../../../../src/features/help/model/articles.ts"
import { helpIndexMarkdown } from "../../../../../src/features/help/model/markdown.ts"
import { articleOf, PRODUCTION } from "../../../../fixtures/Help.ts"

describe("helpIndexMarkdown", () => {
  it("each shelf, each article linked to its Markdown with its description", () => {
    const groups = helpGroups([articleOf("gas", "Gas"), articleOf("recovery", "Recovery")])
    assert.strictEqual(
      helpIndexMarkdown(PRODUCTION, groups),
      [
        "# bluechip help",
        "",
        "How bluechip works: your account and passkeys, agents and their rules, automations, the assistant, cash and recovery.",
        "",
        "## Getting started",
        "",
        "- [Gas](https://bluechip.markets/help/gas.md): Text.",
        "",
        "## Your account",
        "",
        "- [Recovery](https://bluechip.markets/help/recovery.md): Text.",
        ""
      ].join("\n")
    )
  })
})
