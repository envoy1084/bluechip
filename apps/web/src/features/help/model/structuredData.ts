import { BRAND, canonicalUrl, type Site } from "../../../lib/seo/site.ts"
import { HELP_DESCRIPTION, type HelpArticle, type HelpGroup } from "./articles.ts"

const organization = (site: Site) => ({
  "@type": "Organization",
  "@id": `${site.origin}/#organization`,
  name: BRAND,
  url: `${site.origin}/`,
  logo: { "@type": "ImageObject", url: `${site.origin}/icon-512.png`, width: 512, height: 512 }
})

const breadcrumbs = (site: Site, trail: ReadonlyArray<readonly [name: string, path: string]>) => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, path], index) => ({
    "@type": "ListItem",
    position: index + 1,
    name,
    item: canonicalUrl(path, site)
  }))
})

/** The help center's JSON-LD: a collection of its articles, and where it sits under bluechip. */
export const helpIndexStructuredData = (site: Site, groups: ReadonlyArray<HelpGroup>) => {
  const url = canonicalUrl("/help", site)
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: `${BRAND} help`,
        url,
        description: HELP_DESCRIPTION,
        inLanguage: "en",
        isPartOf: { "@id": `${site.origin}/#website` },
        publisher: organization(site),
        hasPart: groups.flatMap((group) =>
          group.articles.map((article) => ({
            "@type": "TechArticle",
            headline: article.title,
            url: canonicalUrl(article.path, site)
          }))
        )
      },
      breadcrumbs(site, [[BRAND, "/"], ["Help", "/help"]])
    ]
  }
}

/** An article's JSON-LD: the article itself, with its sections, and its trail from bluechip through Help. */
export const helpArticleStructuredData = (site: Site, article: HelpArticle, image: string) => {
  const url = canonicalUrl(article.path, site)
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        url,
        mainEntityOfPage: url,
        image: `${site.origin}/og/${site.paper ? "paper" : image}.png`,
        dateModified: article.updated,
        inLanguage: "en",
        articleSection: article.sections.map((section) => section.heading),
        isPartOf: { "@id": `${canonicalUrl("/help", site)}#page` },
        author: organization(site),
        publisher: organization(site)
      },
      breadcrumbs(site, [[BRAND, "/"], ["Help", "/help"], [article.title, article.path]])
    ]
  }
}
