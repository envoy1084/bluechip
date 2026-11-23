import type { ComponentProps, ReactNode } from "react"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { type TickerTone, tickerTone } from "../lib/tickers.ts"
import { CitationChip, type CitationSource } from "./citation-chip.tsx"
import { CASH_SYMBOL, TickerChip } from "./ticker-chip.tsx"

export interface ProposalHolding {
  readonly symbol: string
  /** Percent of the basket. */
  readonly weight: number
  /** The weight bluechip wanted before your max in one stock capped it. */
  readonly cappedFrom?: number
}

export interface ProposalFact {
  readonly text: string
  readonly source?: CitationSource
}

export interface ProposalCardProps extends Omit<ComponentProps<"div">, "children"> {
  readonly title: string
  /** Stocks and their weights. Cash fills the rest, so the basket always adds up to 100%. */
  readonly holdings: ReadonlyArray<ProposalHolding>
  /** Stocks asked for that bluechip doesn't trade. */
  readonly unavailable?: ReadonlyArray<string>
  /** Facts, each with the source it cites. */
  readonly facts?: ReadonlyArray<ProposalFact>
  /** What bluechip assumed about you. */
  readonly assumptions?: ReadonlyArray<string>
  /** bluechip's view, labelled as opinion. */
  readonly opinions?: ReadonlyArray<string>
  /** A tag beside the eyebrow, like an "Example" flag. */
  readonly flag?: ReactNode
  readonly onApprove?: () => void
  readonly onAdjust?: () => void
}

const SEGMENT: Readonly<Record<TickerTone, string>> = {
  blue: "bg-blue",
  yellow: "bg-yellow",
  green: "bg-green",
  pink: "bg-pink",
  ink: "bg-ink",
  cerulean: "bg-cerulean",
  lilac: "bg-lilac",
  tan: "bg-tan"
}

const NONE: ReadonlyArray<never> = []

/** The cash weight that makes the basket add up to 100%. */
export const cashWeight = (holdings: ReadonlyArray<ProposalHolding>): number =>
  Math.max(0, 100 - holdings.reduce((sum, holding) => sum + holding.weight, 0))

function Section({ title, tag, className, children }: {
  readonly title: string
  readonly tag?: string
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <div className={cn("grid gap-2 border-t border-g-100 px-[18px] py-3", className)}>
      <h4 className="flex items-center gap-2 text-label-sm font-semibold text-g-500">
        {title}
        {tag && (
          <span className="rounded-full bg-[#f3e8ff] px-[9px] py-[3px] text-[11.5px] font-semibold text-[#6a2fa8]">
            {tag}
          </span>
        )}
      </h4>
      <ul className="grid list-disc gap-1.5 pl-[18px] text-[13.5px] text-g-800 marker:text-g-300">{children}</ul>
    </div>
  )
}

/**
 * A basket you can inspect when you ask for ideas: weights, facts with sources, the assumptions bluechip made and
 * its opinions, labelled as opinions. It says what it can't offer and what your limits changed. Never a promise.
 */
export function ProposalCard({
  title,
  holdings,
  unavailable = NONE,
  facts = NONE,
  assumptions = NONE,
  opinions = NONE,
  flag,
  onApprove,
  onAdjust,
  className,
  ...props
}: ProposalCardProps) {
  const cash = cashWeight(holdings)
  const basket = [...holdings, ...(cash > 0 ? [{ symbol: CASH_SYMBOL, weight: cash }] : [])]
  const capped = holdings.filter((holding) => holding.cappedFrom !== undefined)
  // Sources are numbered in the order the facts cite them.
  const citationNumber = (index: number) => facts.slice(0, index + 1).filter((fact) => fact.source).length

  return (
    <div
      data-slot="proposal-card"
      className={cn("w-full overflow-hidden rounded-lg bg-white shadow-e2", className)}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5 px-[18px] pt-[18px] pb-3">
        <div className="grid min-w-[200px] flex-1">
          <span className="flex items-center gap-2 text-label-sm font-medium text-g-500">
            Proposal · from your chat{flag}
          </span>
          <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h3>
        </div>
        <span className="rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
          {holdings.length} {holdings.length === 1 ? "stock" : "stocks"}
          {cash > 0 ? " + cash" : ""}
        </span>
      </div>
      <div className="grid gap-2.5 px-[18px] pb-3.5">
        <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-[6px] bg-g-100">
          {basket.map((holding) => (
            <i
              key={holding.symbol}
              className={cn(
                "block min-w-0 shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
                holding.symbol === CASH_SYMBOL ? "bg-[#c3c8d2]" : SEGMENT[tickerTone(holding.symbol)]
              )}
              style={{ flex: holding.weight }}
            />
          ))}
        </div>
        <ul aria-label="Basket" className="flex flex-wrap gap-x-4 gap-y-1.5">
          {basket.map((holding) => (
            <li
              key={holding.symbol}
              data-slot="proposal-weight"
              className="inline-flex items-center gap-1.5 text-[13.5px]"
            >
              <TickerChip symbol={holding.symbol} size="sm" />
              <b className="font-semibold tabular-nums">{holding.weight}%</b>
              {"cappedFrom" in holding && holding.cappedFrom !== undefined && (
                <em className="text-[11.5px] font-semibold text-blue not-italic">capped from {holding.cappedFrom}%</em>
              )}
            </li>
          ))}
        </ul>
      </div>
      {(capped.length > 0 || unavailable.length > 0) && (
        <div className="grid gap-1.5 px-[18px] pb-3.5">
          {capped.map((holding) => (
            <p
              key={holding.symbol}
              className="flex items-center gap-1.5 rounded-sm bg-blue-50 px-2.5 py-[7px] text-label-sm text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]"
            >
              <Icon name="shield" size={14} />Capped {holding.symbol} at {holding.weight}% (your max)
            </p>
          ))}
          {unavailable.length > 0 && (
            <p
              data-slot="proposal-unavailable"
              className="flex flex-wrap items-center gap-1.5 rounded-sm bg-g-50 px-2.5 py-[7px] text-label-sm text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-100)]"
            >
              <Icon name="info" size={14} />
              Not available on bluechip:
              {unavailable.map((symbol) => <TickerChip key={symbol} symbol={symbol} size="sm" unavailable />)}
            </p>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <Section title="Facts">
          {facts.map((fact, index) => (
            <li key={fact.text}>
              {fact.text} {fact.source && <CitationChip index={citationNumber(index)} source={fact.source} />}
            </li>
          ))}
        </Section>
      )}
      {assumptions.length > 0 && (
        <Section title="Assumptions">
          {assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
        </Section>
      )}
      {opinions.length > 0 && (
        <Section
          title="Opinion"
          tag="bluechip's view, not a fact"
          className="bg-[linear-gradient(180deg,#fdfaff,#fff)]"
        >
          {opinions.map((opinion) => <li key={opinion}>{opinion}</li>)}
        </Section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-g-100 bg-[#fafafb] px-[18px] py-3">
        <span className="text-label-sm text-g-500">Prices go down as well as up. This isn't financial advice.</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onAdjust}>Adjust</Button>
          <Button size="sm" onClick={onApprove}>Approve basket</Button>
        </div>
      </div>
    </div>
  )
}
