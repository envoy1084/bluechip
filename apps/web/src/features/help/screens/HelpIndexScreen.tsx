import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { HelpFrame } from "../components/HelpFrame.tsx"
import { HELP_DESCRIPTION } from "../model/articles.ts"
import { HELP_GROUPS } from "../model/content.ts"

/** The help center: every article on its shelf, each a card with what it answers. */
export function HelpIndexScreen() {
  return (
    <HelpFrame>
      <div className="mx-auto grid max-w-[1000px] gap-12">
        <header className="grid gap-3">
          <h1 className="text-[clamp(32px,4.6vw,48px)] leading-[1.04] font-semibold tracking-[-0.04em]">Help</h1>
          <p className="max-w-[56ch] text-body-lg text-g-600">
            {HELP_DESCRIPTION} Signed in, the assistant in Chat answers from these articles too.
          </p>
        </header>

        {HELP_GROUPS.map((group, index) => (
          <section key={group.title} aria-labelledby={`help-group-${index}`} className="grid gap-4">
            <h2 id={`help-group-${index}`} className="text-title-2 font-semibold">{group.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.articles.map((article) => (
                <li key={article.slug} className="grid">
                  <Link
                    to="/help/$slug"
                    params={{ slug: article.slug }}
                    className="group grid content-start gap-1.5 rounded-lg bg-white p-5 shadow-e1 transition-shadow duration-base hover:shadow-e3"
                  >
                    <span className="flex items-center justify-between gap-3 text-title-3 font-semibold">
                      {article.title}
                      <Icon
                        name="arrow-right"
                        size={16}
                        aria-hidden
                        className="shrink-0 text-g-400 transition-transform duration-base ease-brand group-hover:translate-x-0.5 group-hover:text-blue"
                      />
                    </span>
                    <span className="text-body-sm text-g-600">{article.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </HelpFrame>
  )
}
