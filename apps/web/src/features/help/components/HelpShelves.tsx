import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import type { HelpGroup } from "../model/articles.ts"

/** Every article on its shelf, the one being read marked: the help center's sidebar. */
export function HelpShelves({ groups, current }: Readonly<{ groups: ReadonlyArray<HelpGroup>; current: string }>) {
  return (
    <nav aria-label="Help articles" className="grid content-start gap-6">
      {groups.map((group, index) => (
        <div key={group.title} className="grid gap-1.5">
          <span id={`help-shelf-${index}`} className="px-2.5 text-label-sm font-semibold text-g-500">
            {group.title}
          </span>
          <ul aria-labelledby={`help-shelf-${index}`} className="grid gap-0.5">
            {group.articles.map((article) => (
              <li key={article.slug}>
                <Link
                  to="/help/$slug"
                  params={{ slug: article.slug }}
                  aria-current={article.slug === current ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-2.5 py-1.5 text-body-sm text-g-600 transition-colors duration-base",
                    "hover:bg-g-100/70 hover:text-ink aria-[current=page]:bg-blue-50 aria-[current=page]:font-medium aria-[current=page]:text-blue"
                  )}
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
