import { createFileRoute, notFound } from "@tanstack/react-router"
import { groupOf } from "../../features/help/model/articles.ts"
import { HELP_ARTICLES, HELP_GROUPS } from "../../features/help/model/content.ts"
import { helpArticleStructuredData } from "../../features/help/model/structuredData.ts"
import { HelpArticleScreen } from "../../features/help/screens/HelpArticleScreen.tsx"
import { site } from "../../lib/seo/currentSite.ts"
import { jsonLdScript, pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/help/$slug")({
  loader: ({ params }) => {
    const article = HELP_ARTICLES.find((candidate) => candidate.slug === params.slug)
    if (article === undefined) throw notFound()
    return article
  },
  head: ({ loaderData: article }) => {
    if (article === undefined) return {}
    const image = groupOf(HELP_GROUPS, article.slug)?.image ?? "default"
    return {
      ...pageHead({
        fullTitle: `${article.title} | ${site.name} help`,
        description: article.description,
        path: article.path,
        image,
        markdown: true
      }),
      scripts: [jsonLdScript(helpArticleStructuredData(site, article, image))]
    }
  },
  component: HelpArticle
})

function HelpArticle() {
  return <HelpArticleScreen article={Route.useLoaderData()} />
}
