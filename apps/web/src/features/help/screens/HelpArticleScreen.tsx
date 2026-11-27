import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { HelpBlocks } from "../components/HelpBlocks.tsx"
import { HelpFrame } from "../components/HelpFrame.tsx"
import { HelpShelves } from "../components/HelpShelves.tsx"
import { groupOf, type HelpArticle, type HelpSection, neighboursOf } from "../model/articles.ts"
import { HELP_GROUPS } from "../model/content.ts"

/** A help article: the shelves beside it, its sections with their anchors, what's on the page, and the next one. */
export function HelpArticleScreen({ article }: Readonly<{ article: HelpArticle }>) {
  const group = groupOf(HELP_GROUPS, article.slug)
  const { previous, next } = neighboursOf(HELP_GROUPS, article.slug)

  return (
    <HelpFrame>
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_190px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <HelpShelves groups={HELP_GROUPS} current={article.slug} />
          </div>
        </aside>

        <article className="grid max-w-[680px] content-start gap-8">
          <header className="grid gap-3">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-label font-medium text-g-500">
                <li>
                  <Link to="/help" className="rounded-sm hover:text-ink">Help</Link>
                </li>
                {group === undefined ? null : (
                  <li className="flex items-center gap-1.5">
                    <Icon name="chevron-right" size={12} aria-hidden />
                    {group.title}
                  </li>
                )}
              </ol>
            </nav>
            <h1 className="text-[clamp(28px,4vw,36px)] leading-[1.1] font-semibold tracking-[-0.035em] text-balance">
              {article.title}
            </h1>
            {article.intro.length === 0 ? null : (
              <div className="grid gap-3 text-body-lg text-g-600">
                <HelpBlocks blocks={article.intro} />
              </div>
            )}
          </header>

          {article.sections.length > 1 ?
            (
              <div className="rounded-lg bg-white p-4 shadow-e1 xl:hidden">
                <OnThisPage sections={article.sections} />
              </div>
            ) :
            null}

          <div className="grid gap-9">
            {article.sections.map((section) => (
              <section key={section.anchor} aria-labelledby={section.anchor} className="grid gap-3">
                <h2 id={section.anchor} className="scroll-mt-24 text-title-2 font-semibold">
                  <a href={`#${section.anchor}`} className="group/anchor rounded-sm">
                    {section.heading}
                    <span
                      aria-hidden
                      className="ml-2 text-g-300 opacity-0 transition-opacity group-hover/anchor:opacity-100"
                    >
                      #
                    </span>
                  </a>
                </h2>
                <div className="grid gap-3 text-body-lg text-g-700">
                  <HelpBlocks blocks={section.blocks} />
                </div>
              </section>
            ))}
          </div>

          <nav aria-label="More help" className="grid gap-3 border-t border-g-100 pt-6 sm:grid-cols-2">
            {previous === undefined ? <span className="max-sm:hidden" /> : (
              <Link
                to="/help/$slug"
                params={{ slug: previous.slug }}
                className="grid gap-0.5 rounded-lg bg-white p-4 shadow-e1 transition-shadow duration-base hover:shadow-e3"
              >
                <span className="text-label-sm font-medium text-g-500">Previous</span>
                <span className="font-semibold">{previous.title}</span>
              </Link>
            )}
            {next === undefined ? null : (
              <Link
                to="/help/$slug"
                params={{ slug: next.slug }}
                className="grid gap-0.5 rounded-lg bg-white p-4 text-right shadow-e1 transition-shadow duration-base hover:shadow-e3"
              >
                <span className="text-label-sm font-medium text-g-500">Next</span>
                <span className="font-semibold">{next.title}</span>
              </Link>
            )}
            <Link
              to="/help"
              className="rounded-sm text-label font-medium text-blue hover:underline sm:col-span-2 lg:hidden"
            >
              All help articles
            </Link>
          </nav>
        </article>

        {article.sections.length > 1 ?
          (
            <aside className="hidden xl:block">
              <div className="sticky top-24">
                <OnThisPage sections={article.sections} />
              </div>
            </aside>
          ) :
          null}
      </div>
    </HelpFrame>
  )
}

function OnThisPage({ sections }: Readonly<{ sections: ReadonlyArray<HelpSection> }>) {
  return (
    <nav aria-label="On this page" className="grid gap-2">
      <span className="text-label-sm font-semibold text-g-500">On this page</span>
      <ul className="grid gap-1.5">
        {sections.map((section) => (
          <li key={section.anchor}>
            <a href={`#${section.anchor}`} className="rounded-sm text-label text-g-600 hover:text-ink">
              {section.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
