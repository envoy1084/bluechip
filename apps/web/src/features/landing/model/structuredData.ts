import { BRAND, type Site, SITE_DESCRIPTION } from "../../../lib/seo/site.ts"

/**
 * The landing's JSON-LD (schema.org): bluechip as an organization, the website, the web app (free to use: bluechip
 * charges no fee of its own, pools charge theirs) and the FAQ the page shows, as one graph.
 */
export const landingStructuredData = (site: Site, questions: ReadonlyArray<readonly [string, string]>) => {
  const home = `${site.origin}/`
  const organization = `${home}#organization`
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: BRAND,
        url: home,
        logo: { "@type": "ImageObject", url: `${site.origin}/icon-512.png`, width: 512, height: 512 }
      },
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        name: BRAND,
        url: home,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": organization }
      },
      {
        "@type": "WebApplication",
        "@id": `${home}#app`,
        name: BRAND,
        url: home,
        description: SITE_DESCRIPTION,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires a browser with passkeys (WebAuthn)",
        image: `${site.origin}/og/${site.paper ? "paper" : "default"}.png`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": organization }
      },
      {
        "@type": "FAQPage",
        "@id": `${home}#faq`,
        mainEntity: questions.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer }
        }))
      }
    ]
  }
}
