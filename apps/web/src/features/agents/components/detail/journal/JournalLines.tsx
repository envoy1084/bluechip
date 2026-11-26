import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import type { JournalEntry } from "@bluechip/domain/journal/Journal"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatTime } from "@bluechip/ui/lib/format"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import type { ReactNode } from "react"
import { IllustrationTile } from "../../../../../components/IllustrationTile.tsx"
import { localTimeZone } from "../../../../../lib/localTime.ts"
import type { JournalStory, TradeMoment } from "../../../model/journalStory.ts"
import {
  judgmentAnswer,
  MOMENT_LABEL,
  momentNote,
  NOTE_ILLUSTRATION,
  RULES_AUTHOR,
  RULES_ILLUSTRATION,
  RULES_TITLE,
  rulesDetail,
  RUN_LABEL,
  runIllustration,
  runsWhen
} from "../../../model/journalText.ts"
import type { JournalLine, JudgedEntry, RulesMoment } from "../../../model/journalTimeline.ts"

/** What the journal knows of one of the agent's automations: its trigger's type and what sets it off, in words. */
export interface AutomationTrigger {
  readonly type: string
  readonly when: string
}

const PILL = {
  gain: "bg-gain-wash text-gain",
  blue: "bg-blue-50 text-blue",
  loss: "bg-loss-wash text-loss",
  warn: "bg-warn-wash text-warn",
  grey: "bg-g-100 text-g-600"
} as const

type Tone = keyof typeof PILL

const TEXT: Readonly<Record<Tone, string>> = {
  gain: "text-gain",
  blue: "text-blue",
  loss: "text-loss",
  warn: "text-warn",
  grey: "text-g-600"
}

const MOMENT_LOOK: Readonly<Record<TradeMoment, { readonly tone: Tone; readonly icon: IconName }>> = {
  filled: { tone: "gain", icon: "check-circle" },
  sent: { tone: "blue", icon: "check-circle" },
  blocked: { tone: "loss", icon: "stop-sign" },
  needsApproval: { tone: "blue", icon: "face-id" },
  waiting: { tone: "warn", icon: "clock" },
  approved: { tone: "blue", icon: "face-id" },
  failed: { tone: "loss", icon: "error" },
  declined: { tone: "grey", icon: "close" },
  expired: { tone: "grey", icon: "hourglass" },
  cancelled: { tone: "grey", icon: "close" }
}

const RUN_TONE: Readonly<Record<Extract<JournalStory, { _tag: "Run" }>["outcome"], Tone>> = {
  proposed: "blue",
  asked: "blue",
  notified: "grey",
  skipped: "grey",
  failed: "loss"
}

function Pill({ tone, children }: Readonly<{ tone: Tone; children: ReactNode }>) {
  return (
    <span className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", PILL[tone])}>
      {children}
    </span>
  )
}

/** Where a line came from, as a small grey pill: "Automation", "You". */
function Source({ icon, children }: Readonly<{ icon: IconName; children: ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-g-100 px-2 py-px text-[11.5px] font-medium text-g-700">
      <Icon name={icon} size={12} />
      {children}
    </span>
  )
}

/** The reason behind a line, quieter than what happened. */
function Why({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="border-l-2 border-g-200 pl-2.5 text-label-sm text-g-600">
      <span className="font-semibold text-g-500">Why</span> {children}
    </p>
  )
}

/** What was decided, with its icon in its tone. */
function Decided({ icon, tone, children }: Readonly<{ icon: IconName; tone: Tone; children: ReactNode }>) {
  return (
    <span className={cn("flex items-start gap-1.5 text-label-sm font-[550]", TEXT[tone])}>
      <Icon name={icon} size={14} className="mt-px shrink-0" />
      <span>{children}</span>
    </span>
  )
}

/** A line's frame: what leads it, its title and pill with the time on the right, then what it says. */
function Line(
  { lead, title, pill, at, tint, children }: Readonly<{
    lead: ReactNode
    title: ReactNode
    pill?: ReactNode
    at: DateTime.Utc
    tint?: string | false
    children?: ReactNode
  }>
) {
  const date = DateTime.toDateUtc(at)
  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-3.5 border-b border-g-100 px-5 py-4 last:border-b-0",
        tint
      )}
    >
      {lead}
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <b className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</b>
            {pill}
          </span>
          <time dateTime={date.toISOString()} className="text-label-sm text-g-500 tabular-nums">
            {formatTime(date, { timeZone: localTimeZone() })}
          </time>
        </div>
        {children}
      </div>
    </li>
  )
}

/** An automation's name, linking to it when the entry says which one it was. */
function AutomationName({ name, id }: Readonly<{ name: string; id: AutomationId | undefined }>) {
  if (id === undefined) return <>{name}</>
  return (
    <Link to="/automations/$automationId" params={{ automationId: id }} className="hover:underline">
      {name}
    </Link>
  )
}

function TradeLine(
  { entry, story }: Readonly<{ entry: JournalEntry; story: Extract<JournalStory, { _tag: "Trade" }> }>
) {
  const look = MOMENT_LOOK[story.moment]
  const note = momentNote(story.moment, story.side)
  const decided = story.moment === "blocked" ?
    [story.policy, story.decision].filter((part) => part !== null).join(": ") :
    story.decision

  return (
    <Line
      lead={story.symbol === null ?
        <IllustrationTile name="coins" /> :
        <TickerChip symbol={story.symbol} size="md" className="mt-0.5 self-start" />}
      title={story.trade}
      pill={<Pill tone={look.tone}>{MOMENT_LABEL[story.moment]}</Pill>}
      at={entry.at}
      tint={(story.moment === "needsApproval" && "bg-[linear-gradient(180deg,#f8f9ff,#f3f5ff)]") ||
        (story.moment === "blocked" && "bg-[linear-gradient(180deg,#fff8f6,#fff3ef)]")}
    >
      {decided === null || decided === "" ? null : <Decided icon={look.icon} tone={look.tone}>{decided}</Decided>}
      {note === null ?
        null :
        story.moment === "sent" ?
        <Decided icon={look.icon} tone="gain">{note}</Decided> :
        <span className="text-label-sm text-g-600">{note}</span>}
      {story.why === null ? null : <Why>{story.why}</Why>}
    </Line>
  )
}

/** A run's judgments, inside it: each question the model was asked, its answer and why. */
function Judgments({ judgments }: Readonly<{ judgments: ReadonlyArray<JudgedEntry> }>) {
  return (
    <span className="mt-0.5 grid gap-2 rounded-[10px] px-3 py-2.5 surface-well">
      {judgments.map(({ entry, story }) => (
        <span key={entry.id} className="grid gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm">
            <Icon name="scales" size={13} className="shrink-0 text-g-500" />
            <span className="min-w-0 font-semibold text-g-800">Judged “{story.headline}”</span>
            <Pill tone={story.verdict ? "gain" : "grey"}>{judgmentAnswer(story.verdict, story.confidence)}</Pill>
          </span>
          {story.reason === "" ? null : <span className="pl-[21px] text-label-sm text-g-600">{story.reason}</span>}
        </span>
      ))}
    </span>
  )
}

/**
 * A run of one of its automations: what set it off as its illustration, its name linking to it with how it ended,
 * what sets it off and why it ended so, and the judgments made on the way.
 */
function RunLine(
  { entry, story, judgments, trigger }: Readonly<{
    entry: JournalEntry
    story: Extract<JournalStory, { _tag: "Run" }>
    judgments: ReadonlyArray<JudgedEntry>
    trigger: AutomationTrigger | undefined
  }>
) {
  return (
    <Line
      lead={<IllustrationTile name={runIllustration(trigger?.type)} />}
      title={<AutomationName name={story.automation} id={entry.refs.automationId} />}
      pill={<Pill tone={RUN_TONE[story.outcome]}>{RUN_LABEL[story.outcome]}</Pill>}
      at={entry.at}
      tint={story.outcome === "failed" && "bg-[linear-gradient(180deg,#fff8f6,#fff3ef)]"}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-g-500">
        <Source icon="zap">Automation</Source>
        {trigger === undefined ? null : <span className="min-w-0">{runsWhen(trigger.when)}</span>}
      </span>
      {story.reason === "" ? null : <Why>{story.reason}</Why>}
      {judgments.length === 0 ? null : <Judgments judgments={judgments} />}
    </Line>
  )
}

/** A judgment whose run isn't loaded yet, on its own line, naming its automation. */
function JudgmentLine(
  { entry, story }: Readonly<{ entry: JournalEntry; story: Extract<JournalStory, { _tag: "Judgment" }> }>
) {
  return (
    <Line
      lead={<IllustrationTile name="scales" />}
      title={`Judged “${story.headline}”`}
      pill={<Pill tone={story.verdict ? "gain" : "grey"}>{judgmentAnswer(story.verdict, story.confidence)}</Pill>}
      at={entry.at}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Source icon="zap">
          <AutomationName name={story.automation} id={entry.refs.automationId} />
        </Source>
      </span>
      {story.reason === "" ? null : <Why>{story.reason}</Why>}
    </Line>
  )
}

function RulesLine(
  { moment, agentId, nameOf }: Readonly<{
    moment: RulesMoment
    agentId: AgentId
    nameOf: (symbol: StockSymbol) => string
  }>
) {
  const showsStocks = moment.change === "locked" || moment.change === "changed"

  return (
    <Line
      lead={<IllustrationTile name={RULES_ILLUSTRATION[moment.change]} />}
      title={RULES_TITLE[moment.change]}
      at={moment.at}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-g-600">
        {moment.change === "ranOut" ? null : <Source icon="user">{RULES_AUTHOR[moment.by]}</Source>}
        <span className="min-w-0">{rulesDetail(moment)}</span>
      </span>
      {showsStocks && moment.stocks.length > 0 ?
        (
          <span className="flex flex-wrap items-center gap-1.5">
            {moment.stocks.map((symbol) => (
              <span key={symbol} title={nameOf(symbol)} className="inline-flex">
                <TickerChip symbol={symbol} size="sm" />
              </span>
            ))}
          </span>
        ) :
        null}
      {moment.change === "changed" ?
        (
          <Link
            to="/agents/$agentId/history"
            params={{ agentId }}
            className="inline-flex w-fit items-center gap-1 text-label-sm font-semibold text-blue"
          >
            What changed<Icon name="arrow-right" size={13} />
          </Link>
        ) :
        null}
    </Line>
  )
}

/** One line of the journal, drawn for what it tells: a trade, a run, a judgment, its rules, or a note as written. */
export function JournalLineRow(
  { line, agentId, nameOf, triggerOf }: Readonly<{
    line: JournalLine
    agentId: AgentId
    nameOf: (symbol: StockSymbol) => string
    triggerOf: (id: AutomationId) => AutomationTrigger | undefined
  }>
) {
  if (line._tag === "Rules") return <RulesLine moment={line} agentId={agentId} nameOf={nameOf} />

  const { entry, story } = line
  switch (story._tag) {
    case "Trade":
      return <TradeLine entry={entry} story={story} />
    case "Run":
      return (
        <RunLine
          entry={entry}
          story={story}
          judgments={line.judgments}
          trigger={entry.refs.automationId === undefined ? undefined : triggerOf(entry.refs.automationId)}
        />
      )
    case "Judgment":
      return <JudgmentLine entry={entry} story={story} />
    case "Note":
      return <Line lead={<IllustrationTile name={NOTE_ILLUSTRATION[entry.kind]} />} title={story.text} at={entry.at} />
  }
}
