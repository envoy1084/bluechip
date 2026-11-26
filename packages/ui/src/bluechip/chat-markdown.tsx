import { createCodePlugin } from "@streamdown/code"
import { createMathPlugin } from "@streamdown/math"
import { createContext, memo, type ReactNode, useContext, useState } from "react"
import { type Components, Streamdown } from "streamdown"
import { Button } from "../components/button.tsx"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../components/dialog.tsx"
import { cn } from "../lib/cn.ts"
import { CitationChip, type CitationSource } from "./citation-chip.tsx"
import { TickerChip } from "./ticker-chip.tsx"

// One light theme: bluechip has no dark mode.
const plugins = {
  code: createCodePlugin({ themes: ["github-light", "github-light"] }),
  math: createMathPlugin()
}

// bluechip's own inline marks, as tags Streamdown lets through: `[[NVDA]]` is a ticker chip, `[^1]` the first source.
// A mark still arriving (`[[NV`) stays text until it closes.
const ALLOWED_TAGS = { ticker: ["symbol"], citation: ["index"] }

const withMarks = (text: string): string =>
  text
    .replaceAll(/\[\[([A-Z]{1,6})\]\]/g, "<ticker symbol=\"$1\"></ticker>")
    .replaceAll(/\[\^(\d{1,2})\]/g, "<citation index=\"$1\"></citation>")

const prose: Components = {
  p: ({ node: _node, className, ...props }) => <p className={cn("my-0 [&+*]:mt-2.5", className)} {...props} />,
  strong: ({ node: _node, className, ...props }) => (
    <strong className={cn("font-semibold text-ink", className)} {...props} />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul className={cn("my-2.5 grid list-disc gap-1 pl-[18px] marker:text-g-400", className)} {...props} />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol className={cn("my-2.5 grid list-decimal gap-1 pl-[20px] marker:text-g-500", className)} {...props} />
  ),
  li: ({ node: _node, className, ...props }) => <li className={cn("pl-0.5", className)} {...props} />,
  h1: ({ node: _node, className, children, ...props }) => (
    <h3
      className={cn("mt-4 mb-2 text-[19px] leading-tight font-semibold tracking-[-0.02em] text-ink", className)}
      {...props}
    >
      {children}
    </h3>
  ),
  h2: ({ node: _node, className, children, ...props }) => (
    <h3
      className={cn("mt-4 mb-1.5 text-[17px] leading-snug font-semibold tracking-[-0.015em] text-ink", className)}
      {...props}
    >
      {children}
    </h3>
  ),
  h3: ({ node: _node, className, children, ...props }) => (
    <h4 className={cn("mt-3 mb-1 text-[14.5px] font-semibold text-ink", className)} {...props}>{children}</h4>
  ),
  inlineCode: ({ node: _node, className, ...props }) => (
    <code className={cn("rounded-[5px] bg-g-100 px-1 py-px font-mono text-[13px] text-ink", className)} {...props} />
  )
}

const Sources = createContext<ReadonlyArray<CitationSource>>([])

/** Draws a link to a page of the app, such as with the router's own link. */
export type ChatInternalLink = (
  link: { readonly href: string; readonly className: string; readonly children?: ReactNode }
) => ReactNode

const InternalLinks = createContext<ChatInternalLink | undefined>(undefined)

const LINK = "font-medium text-blue underline decoration-blue/30 underline-offset-2 hover:decoration-blue"

// A path in the app (`/help/agents#policies`) or on the page; anything with a host leaves bluechip.
const isInternal = (href: string): boolean => (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")

const hostOf = (href: string): string => {
  try {
    return new URL(href).host
  } catch {
    return href
  }
}

/** A link in an answer: the app's own pages open in place; another site asks first, as it isn't bluechip's. */
function ChatLink({ href, children }: Readonly<{ href?: string | undefined; children?: ReactNode }>) {
  const internal = useContext(InternalLinks)
  const [leaving, setLeaving] = useState(false)
  if (href === undefined || href === "") return <span>{children}</span>
  if (isInternal(href)) {
    return internal === undefined ?
      <a href={href} className={LINK}>{children}</a> :
      internal({ href, className: LINK, children })
  }

  const host = hostOf(href)
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={LINK}
        onClick={(event) => {
          event.preventDefault()
          setLeaving(true)
        }}
      >
        {children}
      </a>
      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open {host}?</DialogTitle>
            <DialogDescription>
              It opens in a new tab. bluechip doesn't run that site or check what it says.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-[12px] px-3 py-2.5 text-label break-all text-g-700 surface-well">{href}</p>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Stay here</DialogClose>
            <Button
              onClick={() => {
                window.open(href, "_blank", "noopener,noreferrer")
                setLeaving(false)
              }}
            >
              Open link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const NO_SOURCES: ReadonlyArray<CitationSource> = []

function Ticker({ symbol }: Readonly<Record<string, unknown>>) {
  if (typeof symbol !== "string") return null
  return <TickerChip symbol={symbol} size="sm" className="mr-[3px] align-[1px]" />
}

function Citation({ index }: Readonly<Record<string, unknown>>) {
  const source = useContext(Sources)[Number(index) - 1]
  return source === undefined ? null : <CitationChip index={Number(index)} source={source} />
}

const CONTROLS = { code: { copy: true, download: false }, table: false, mermaid: false } as const

// Links go through `ChatLink`, which asks before another site in bluechip's own dialog.
const LINK_SAFETY = { enabled: false } as const

const components: Components = {
  ...prose,
  a: ({ node: _node, href, children }) => <ChatLink href={href}>{children}</ChatLink>,
  ticker: Ticker,
  citation: Citation
}

export interface ChatMarkdownProps {
  /** The answer as markdown; while it streams, unfinished blocks (a bold, a list, a code fence) render as they will end. */
  readonly text: string
  readonly sources?: ReadonlyArray<CitationSource>
  /** Still arriving: shows the caret after the text. */
  readonly streaming?: boolean
  /** How links to the app's own pages (`/help/agents`) are drawn; a plain link without it. */
  readonly internalLink?: ChatInternalLink | undefined
  readonly className?: string
}

/**
 * bluechip's answers as streaming markdown, rendered by Streamdown (Vercel's renderer for AI Elements): incomplete
 * markdown is closed as it streams, code is highlighted by Shiki (with a copy button), math typeset by KaTeX. Links to
 * the app's pages open in place (`internalLink`); links to other sites ask before leaving.
 * `[[NVDA]]` shows a ticker chip and `[^1]` cites the first of `sources`.
 */
export const ChatMarkdown = memo(function ChatMarkdown(
  { text, sources = NO_SOURCES, streaming = false, internalLink, className }: ChatMarkdownProps
) {
  return (
    <InternalLinks value={internalLink}>
      <Sources value={sources}>
        <div data-slot="chat-markdown" className={cn("min-w-0 text-[14.5px] leading-[1.6] text-g-800", className)}>
          <Streamdown
            mode={streaming ? "streaming" : "static"}
            isAnimating={streaming}
            caret="block"
            plugins={plugins}
            allowedTags={ALLOWED_TAGS}
            components={components}
            controls={CONTROLS}
            linkSafety={LINK_SAFETY}
          >
            {withMarks(text)}
          </Streamdown>
        </div>
      </Sources>
    </InternalLinks>
  )
})
