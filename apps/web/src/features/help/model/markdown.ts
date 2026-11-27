import { canonicalUrl, markdownPath, type Site } from "../../../lib/seo/site.ts"
import { HELP_DESCRIPTION, type HelpGroup } from "./articles.ts"

/** `/help.md`: the help center's index for agents, each article linked to its own Markdown with its description. */
export const helpIndexMarkdown = (site: Site, groups: ReadonlyArray<HelpGroup>): string =>
  [
    "# bluechip help",
    "",
    HELP_DESCRIPTION,
    "",
    ...groups.flatMap((group) => [
      `## ${group.title}`,
      "",
      ...group.articles.map((article) =>
        `- [${article.title}](${canonicalUrl(markdownPath(article.path), site)}): ${article.description}`
      ),
      ""
    ])
  ].join("\n")
