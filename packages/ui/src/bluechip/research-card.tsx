import { Icon } from "../icons/icon.tsx"
import { ChatCard } from "./chat-card.tsx"

export interface ResearchCitation {
  readonly url: string
  /** The page's title; its site stands in when it has none. */
  readonly title: string
  /** The words the answer leans on. */
  readonly citedText: string | null
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** The web pages the assistant read for an answer, each once, with the words it leans on. bluechip doesn't check them. */
export function ResearchCard(
  { query, citations }: { readonly query: string; readonly citations: ReadonlyArray<ResearchCitation> }
) {
  const pages = citations.filter((citation, index, all) => all.findIndex(({ url }) => url === citation.url) === index)

  return (
    <ChatCard tag="From the web" icon="globe" state="Not checked by bluechip" tone="quiet">
      <p className="text-label-sm text-g-500">Searched for “{query}”</p>
      {pages.length === 0 ?
        <p className="text-[13.5px] text-g-700">No pages to cite.</p> :
        (
          <ol className="grid divide-y divide-g-100">
            {pages.map((citation) => (
              <li key={citation.url} className="grid gap-0.5 py-2 first:pt-0 last:pb-0">
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-blue"
                >
                  <span className="truncate">{citation.title || hostOf(citation.url)}</span>
                  <Icon name="external" size={12} className="shrink-0 text-g-400" />
                </a>
                <span className="text-caption text-g-500">{hostOf(citation.url)}</span>
                {citation.citedText === null ?
                  null :
                  <q className="line-clamp-2 text-label-sm text-g-600">{citation.citedText}</q>}
              </li>
            ))}
          </ol>
        )}
    </ChatCard>
  )
}
