import { assert, describe, it } from "@effect/vitest"
import { helpGroups } from "../../../../../src/features/help/model/articles.ts"
import {
  helpArticleStructuredData,
  helpIndexStructuredData
} from "../../../../../src/features/help/model/structuredData.ts"
import { articleOf, PAPER, PRODUCTION } from "../../../../fixtures/Help.ts"

const ORGANIZATION = {
  "@type": "Organization",
  "@id": "https://bluechip.markets/#organization",
  name: "bluechip",
  url: "https://bluechip.markets/",
  logo: { "@type": "ImageObject", url: "https://bluechip.markets/icon-512.png", width: 512, height: 512 }
}

describe("helpArticleStructuredData", () => {
  it("the article with its sections and date, and its trail through Help", () => {
    assert.deepStrictEqual(helpArticleStructuredData(PRODUCTION, articleOf("gas", "Gas"), "default"), {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "TechArticle",
          "@id": "https://bluechip.markets/help/gas#article",
          headline: "Gas",
          description: "Text.",
          url: "https://bluechip.markets/help/gas",
          mainEntityOfPage: "https://bluechip.markets/help/gas",
          image: "https://bluechip.markets/og/default.png",
          dateModified: "2026-11-27",
          inLanguage: "en",
          articleSection: ["About"],
          isPartOf: { "@id": "https://bluechip.markets/help#page" },
          author: ORGANIZATION,
          publisher: ORGANIZATION
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "bluechip", item: "https://bluechip.markets/" },
            { "@type": "ListItem", position: 2, name: "Help", item: "https://bluechip.markets/help" },
            { "@type": "ListItem", position: 3, name: "Gas", item: "https://bluechip.markets/help/gas" }
          ]
        }
      ]
    })
  })

  it("paper money's article shows the paper card", () => {
    const [article] = helpArticleStructuredData(PAPER, articleOf("gas", "Gas"), "agents")["@graph"]
    assert.include(JSON.stringify(article), `"image":"https://paper.bluechip.markets/og/paper.png"`)
  })
})

describe("helpIndexStructuredData", () => {
  it("a collection of every article, and its trail", () => {
    const groups = helpGroups([articleOf("gas", "Gas"), articleOf("recovery", "Recovery")])
    assert.deepStrictEqual(helpIndexStructuredData(PRODUCTION, groups)["@graph"], [
      {
        "@type": "CollectionPage",
        "@id": "https://bluechip.markets/help#page",
        name: "bluechip help",
        url: "https://bluechip.markets/help",
        description:
          "How bluechip works: your account and passkeys, AI agents and the rules they keep, automations, the assistant, adding cash, gas and recovery.",
        inLanguage: "en",
        isPartOf: { "@id": "https://bluechip.markets/#website" },
        publisher: ORGANIZATION,
        hasPart: [
          { "@type": "TechArticle", headline: "Gas", url: "https://bluechip.markets/help/gas" },
          { "@type": "TechArticle", headline: "Recovery", url: "https://bluechip.markets/help/recovery" }
        ]
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "bluechip", item: "https://bluechip.markets/" },
          { "@type": "ListItem", position: 2, name: "Help", item: "https://bluechip.markets/help" }
        ]
      }
    ])
  })
})
