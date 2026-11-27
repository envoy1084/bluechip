import { assert, describe, it } from "@effect/vitest"
import {
  blocksOf,
  descriptionOf,
  helpArticle,
  helpGroups,
  helpSitemapPages,
  neighboursOf,
  slugOf
} from "../../../../../src/features/help/model/articles.ts"
import { articleOf } from "../../../../fixtures/Help.ts"

describe("blocksOf", () => {
  it("a paragraph's wrapped lines join into one", () => {
    assert.deepStrictEqual(blocksOf("Every trade costs\na little gas."), [
      { _tag: "Paragraph", text: "Every trade costs a little gas." }
    ])
  })

  it("a list, with an item that wraps onto the next line", () => {
    assert.deepStrictEqual(blocksOf("- Everywhere: approvals.\n- In app and Telegram: trades,\n  cash arrived."), [
      { _tag: "List", items: ["Everywhere: approvals.", "In app and Telegram: trades, cash arrived."] }
    ])
  })

  it("blank lines separate a paragraph from a list", () => {
    assert.deepStrictEqual(blocksOf("Triggers:\n\n- On a schedule.\n\nThen it acts."), [
      { _tag: "Paragraph", text: "Triggers:" },
      { _tag: "List", items: ["On a schedule."] },
      { _tag: "Paragraph", text: "Then it acts." }
    ])
  })

  it("empty text has no blocks", () => {
    assert.deepStrictEqual(blocksOf("\n\n  \n"), [])
  })
})

describe("descriptionOf", () => {
  it("a paragraph of 200 characters or fewer is kept whole", () => {
    const paragraph = `${"a".repeat(198)}.`
    assert.strictEqual(descriptionOf(paragraph), paragraph)
  })

  it("a longer paragraph keeps the whole sentences that fit", () => {
    const first = `${"a".repeat(98)}.`
    const second = `${"b".repeat(98)}.`
    assert.strictEqual(descriptionOf(`${first} ${second} Third sentence.`), `${first} ${second}`)
  })

  it("a first sentence longer than 200 characters is kept whole", () => {
    const first = `${"a".repeat(250)}.`
    assert.strictEqual(descriptionOf(`${first} Short one.`), first)
  })
})

describe("helpArticle", () => {
  it("the title, sections with the assistant's anchors, the first paragraph as description and the file itself", () => {
    const markdown = "# Gas\n\n## Who pays gas\n\nbluechip pays it.\n\n## The gas budget\n\n- A cap a day.\n"
    assert.deepStrictEqual(helpArticle("gas", markdown, "2026-11-27"), {
      slug: "gas",
      path: "/help/gas",
      title: "Gas",
      description: "bluechip pays it.",
      intro: [],
      sections: [
        { heading: "Who pays gas", anchor: "who-pays-gas", blocks: [{ _tag: "Paragraph", text: "bluechip pays it." }] },
        { heading: "The gas budget", anchor: "the-gas-budget", blocks: [{ _tag: "List", items: ["A cap a day."] }] }
      ],
      markdown,
      updated: "2026-11-27"
    })
  })

  it("text before the first heading is the intro, and the description", () => {
    const article = helpArticle("gas", "# Gas\n\nWhat gas is.\n\n## Who pays gas\n\nbluechip.\n", "2026-11-27")
    assert.deepStrictEqual([article.intro, article.description], [
      [{ _tag: "Paragraph", text: "What gas is." }],
      "What gas is."
    ])
  })

  it("an anchor of a heading with punctuation, as the assistant links it", () => {
    const article = helpArticle("recovery", "# Recovery\n\n## If you lose every passkey\n\nUse it.\n", "2026-11-27")
    assert.strictEqual(article.sections[0]!.anchor, "if-you-lose-every-passkey")
  })
})

describe("slugOf", () => {
  it("a file's name without its folder and extension", () => {
    assert.strictEqual(slugOf("../../../../../../content/help/paper-money.md"), "paper-money")
  })
})

describe("helpGroups", () => {
  it("articles on their shelves in reading order; empty shelves are left out", () => {
    const groups = helpGroups([articleOf("funding", "Cash"), articleOf("getting-started", "Getting started")])
    assert.deepStrictEqual(groups.map((group) => [group.title, group.articles.map((a) => a.slug)]), [
      ["Getting started", ["getting-started", "funding"]]
    ])
  })

  it("an article no shelf names goes under More, by title", () => {
    const groups = helpGroups([articleOf("zebra", "Zebra"), articleOf("apple", "Apple"), articleOf("gas", "Gas")])
    assert.deepStrictEqual(groups.map((group) => [group.title, group.articles.map((a) => a.slug)]), [
      ["Getting started", ["gas"]],
      ["More", ["apple", "zebra"]]
    ])
  })
})

describe("neighboursOf", () => {
  const groups = helpGroups([articleOf("gas", "Gas"), articleOf("agents", "Agents"), articleOf("recovery", "Recovery")])

  it("the first article has only a next one, across shelves", () => {
    const { previous, next } = neighboursOf(groups, "gas")
    assert.deepStrictEqual([previous?.slug, next?.slug], [undefined, "agents"])
  })

  it("a middle article has both", () => {
    const { previous, next } = neighboursOf(groups, "agents")
    assert.deepStrictEqual([previous?.slug, next?.slug], ["gas", "recovery"])
  })

  it("the last article has only a previous one", () => {
    const { previous, next } = neighboursOf(groups, "recovery")
    assert.deepStrictEqual([previous?.slug, next?.slug], ["agents", undefined])
  })

  it("an unknown article has neither", () => {
    const { previous, next } = neighboursOf(groups, "missing")
    assert.deepStrictEqual([previous, next], [undefined, undefined])
  })
})

describe("helpSitemapPages", () => {
  it("the index dated by its newest article, then every article", () => {
    const groups = helpGroups([articleOf("gas", "Gas", "2026-11-20"), articleOf("agents", "Agents", "2026-11-25")])
    assert.deepStrictEqual(helpSitemapPages(groups), [
      { path: "/help", updated: "2026-11-25", priority: 0.6 },
      { path: "/help/gas", updated: "2026-11-20", priority: 0.5 },
      { path: "/help/agents", updated: "2026-11-25", priority: 0.5 }
    ])
  })

  it("no articles, no help pages", () => {
    assert.deepStrictEqual(helpSitemapPages([]), [])
  })
})
