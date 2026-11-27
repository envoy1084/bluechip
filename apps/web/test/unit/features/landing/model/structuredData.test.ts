import { assert, describe, it } from "@effect/vitest"
import { landingStructuredData } from "../../../../../src/features/landing/model/structuredData.ts"
import { SITE_DESCRIPTION } from "../../../../../src/lib/seo/site.ts"

const production = { origin: "https://bluechip.markets", indexed: true, name: "bluechip", paper: false }

describe("landingStructuredData", () => {
  it("bluechip, its website, the web app and the FAQ, as one graph", () => {
    assert.deepStrictEqual(landingStructuredData(production, [["Who pays for gas?", "Your account, in ETH."]]), {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://bluechip.markets/#organization",
          name: "bluechip",
          url: "https://bluechip.markets/",
          logo: { "@type": "ImageObject", url: "https://bluechip.markets/icon-512.png", width: 512, height: 512 }
        },
        {
          "@type": "WebSite",
          "@id": "https://bluechip.markets/#website",
          name: "bluechip",
          url: "https://bluechip.markets/",
          description: SITE_DESCRIPTION,
          inLanguage: "en",
          publisher: { "@id": "https://bluechip.markets/#organization" }
        },
        {
          "@type": "WebApplication",
          "@id": "https://bluechip.markets/#app",
          name: "bluechip",
          url: "https://bluechip.markets/",
          description: SITE_DESCRIPTION,
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires a browser with passkeys (WebAuthn)",
          image: "https://bluechip.markets/og/default.png",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@id": "https://bluechip.markets/#organization" }
        },
        {
          "@type": "FAQPage",
          "@id": "https://bluechip.markets/#faq",
          mainEntity: [
            {
              "@type": "Question",
              name: "Who pays for gas?",
              acceptedAnswer: { "@type": "Answer", text: "Your account, in ETH." }
            }
          ]
        }
      ]
    })
  })
})
