import { type ComponentProps, type ReactNode, useId } from "react"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { CitationChip, type CitationSource } from "./citation-chip.tsx"
import { TickerChip } from "./ticker-chip.tsx"

export type ChatMessageStatus = "streaming" | "done" | "error"

export interface ChatMessageProps extends Omit<ComponentProps<"div">, "children"> {
  readonly from: "you" | "bluechip"
  /**
   * The message in simple rich text: `**bold**`, lines starting with `- ` as a list, `[[NVDA]]` for a ticker chip
   * and `[^1]` for the first of `sources`.
   */
  readonly text?: string
  /** `streaming` shows three dots until text arrives, then a caret after it. Defaults to `done`. */
  readonly status?: ChatMessageStatus
  readonly sources?: ReadonlyArray<CitationSource>
  /** Tool-call rows, shown above bluechip's text. */
  readonly toolCalls?: ReactNode
  /** Cards that come with the answer (a proposal, an agent draft), shown below the text. */
  readonly attachments?: ReactNode
  /** With `status="error"`: what went wrong and what to try next. */
  readonly error?: string
  readonly onRetry?: () => void
}

const NO_SOURCES: ReadonlyArray<CitationSource> = []

const INLINE = /\*\*(.+?)\*\*|\[\[([A-Z]+)\]\]|\[\^(\d+)\]/g

function renderInline(line: string, sources: ReadonlyArray<CitationSource>): ReactNode {
  const parts: Array<ReactNode> = []
  let last = 0
  for (const match of line.matchAll(INLINE)) {
    parts.push(line.slice(last, match.index))
    const [token, bold, symbol, cite] = match
    if (bold !== undefined) parts.push(<b key={match.index} className="font-semibold text-ink">{bold}</b>)
    else if (symbol !== undefined) {
      parts.push(<TickerChip key={match.index} symbol={symbol} size="sm" className="mr-[3px] align-[1px]" />)
    } else {
      const source = sources[Number(cite) - 1]
      parts.push(source ? <CitationChip key={match.index} index={Number(cite)} source={source} /> : token)
    }
    last = match.index + token.length
  }
  parts.push(line.slice(last))
  return parts
}

const caret = (
  <span
    data-slot="chat-caret"
    aria-hidden
    className="ml-0.5 inline-block h-[15px] w-[7px] animate-pulse rounded-[1px] bg-blue align-[-2px] motion-reduce:animate-none"
  />
)

/** Splits rich text into paragraphs and lists; the caret, when streaming, follows the last block's text. */
function RichText({ text, sources, streaming }: {
  readonly text: string
  readonly sources: ReadonlyArray<CitationSource>
  readonly streaming: boolean
}) {
  // Each line keeps its line number in the text as a stable key.
  type Line = { readonly n: number; readonly text: string }
  const blocks: Array<{ readonly list: boolean; readonly lines: Array<Line> }> = []
  text.split("\n").forEach((raw, n) => {
    const item = raw.startsWith("- ")
    if (!item && raw.trim() === "") return
    const line = { n, text: item ? raw.slice(2) : raw }
    const previous = blocks.at(-1)
    if (item && previous?.list) previous.lines.push(line)
    else blocks.push({ list: item, lines: [line] })
  })
  const lastLine = blocks.at(-1)?.lines.at(-1)
  const body = (line: Line) => (
    <>
      {renderInline(line.text, sources)}
      {streaming && line === lastLine && caret}
    </>
  )
  return blocks.map((block) => {
    const first = block.lines[0]!
    if (!block.list) return <p key={first.n}>{body(first)}</p>
    return (
      <ul key={first.n} className="grid list-disc gap-1 pl-[18px] marker:text-g-400">
        {block.lines.map((line) => <li key={line.n}>{body(line)}</li>)}
      </ul>
    )
  })
}

/** bluechip's rising chip mark. */
function BotMark() {
  const mask = useId()
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(180deg,#fff,#f1f3f8)] text-blue shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08),0_2px_4px_-1px_rgba(10,11,13,.1)]"
    >
      <svg width={16} height={16} viewBox="0 0 64 64">
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <circle cx="32" cy="32" r="30" fill="#fff" />
          <polyline
            points="-2,48 22,32 32,40 66,12"
            fill="none"
            stroke="#000"
            strokeWidth="7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </mask>
        <rect width="64" height="64" fill="currentColor" mask={`url(#${mask})`} />
      </svg>
    </span>
  )
}

/**
 * One message in the chat. You on the right in a soft bubble; bluechip on the left with the chip mark and no
 * bubble, so long answers read like a page.
 */
export function ChatMessage({
  from,
  text = "",
  status = "done",
  sources = NO_SOURCES,
  toolCalls,
  attachments,
  error,
  onRetry,
  className,
  ...props
}: ChatMessageProps) {
  if (from === "you") {
    return (
      <div
        data-slot="chat-message"
        data-from="you"
        className={cn("flex min-w-0 justify-end pl-[20%]", className)}
        {...props}
      >
        <div className="max-w-[52ch] rounded-[16px_16px_4px_16px] bg-[linear-gradient(180deg,#f1f3f7,#eceff4)] px-3.5 py-[9px] text-[14.5px] wrap-break-word text-ink shadow-[inset_0_0_0_1px_rgba(10,11,13,.04)]">
          <span className="sr-only">You:</span>
          <span className="whitespace-pre-wrap">{text}</span>
        </div>
      </div>
    )
  }
  const streaming = status === "streaming"
  return (
    <div
      data-slot="chat-message"
      data-from="bluechip"
      data-status={status}
      aria-busy={streaming || undefined}
      className={cn("flex min-w-0 gap-2.5", className)}
      {...props}
    >
      <BotMark />
      <div className="grid max-w-[68ch] min-w-0 flex-1 content-start gap-2 pt-[3px] text-[14.5px] text-g-800">
        <span className="sr-only">bluechip:</span>
        {toolCalls}
        {streaming && text === "" ?
          (
            <output aria-label="bluechip is typing" className="inline-flex gap-1 py-2">
              {[0, 150, 300].map((delay) => (
                <i
                  key={delay}
                  className="size-1.5 animate-pulse rounded-full bg-g-400 motion-reduce:animate-none"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </output>
          ) :
          text && <RichText text={text} sources={sources} streaming={streaming} />}
        {status === "error" && (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-warn-wash py-2 pr-2.5 pl-3 text-[13.5px] text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]">
            <Icon name="warning" size={14} />
            <span className="min-w-40 flex-1">{error ?? "Something went wrong. Try again in a minute."}</span>
            {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>}
          </div>
        )}
        {attachments}
      </div>
    </div>
  )
}
