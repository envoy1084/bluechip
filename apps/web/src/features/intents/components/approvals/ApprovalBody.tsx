import { describeDecision, describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { useStockLookup } from "../../../../hooks/useStockLookup.ts"
import { priceDollars, shareCount, usdcDollars } from "../../../../lib/amounts.ts"
import { nothingMoved, tradeOutcome, type TradeStage } from "../../../../lib/tradeOutcome.ts"
import type { useApproveIntent } from "../../hooks/useApproveIntent.ts"
import { useLatestIntents } from "../../hooks/useLatestIntent.ts"
import { clockTime, expiresIn } from "../../model/intentText.ts"

type Approval = ReturnType<typeof useApproveIntent>

const stageOf = (intent: Intent): TradeStage =>
  intent.status === "filled" || intent.status === "failed" || intent.status === "confirming" ?
    intent.status :
    "sending"

/** Each trade one Face ID sends: the trade, the price now and what it gets at it, and its step in a plan. */
function Trades({ trades }: Readonly<{ trades: ReadonlyArray<Intent> }>) {
  const { nameOf, stockOf } = useStockLookup()

  return (
    <ul className="grid divide-y divide-ink/5 rounded-md bg-g-50 px-3.5">
      {trades.map((intent) => {
        const stock = stockOf(intent.leg.symbol)
        const price = stock?.price?.price ?? stock?.reference?.price ?? null
        const { amount } = intent.leg
        // "You get about 0.26 shares at $190.62 a share", or what a sale brings in.
        const estimate = price === null ?
          null :
          "usdc" in amount ?
          `You get about ${formatShareCount(shareCount(sharesFor(Usdc.make(amount.usdc), price)))}` :
          `You receive about ${formatMoney(usdcDollars(valueOf(Shares.make(amount.shares), price)))}`
        const atPrice = price === null ? null : `${estimate} at ${formatMoney(priceDollars(price))} a share`
        // A plan can trade one stock twice, in two steps: the step tells them apart.
        const step = intent.batch !== null && intent.batch.wave > 0 ? `step ${intent.batch.wave + 1} of the plan` : null
        const line = atPrice === null ? step : step === null ? atPrice : `${atPrice}, ${step}`

        return (
          <li key={intent.id} className="flex items-center gap-3 py-2.5">
            <TickerChip symbol={intent.leg.symbol} size="sm" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <b className="text-label font-semibold">{describeLeg(intent.leg, nameOf)}</b>
              {line === null ? null : <span className="text-label-sm text-g-500 tabular-nums">{line}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** After Face ID: one outcome for what was sent, then each trade of it as it lands. */
function Sent(
  { trades, onDone }: Readonly<{ trades: ReadonlyArray<Intent>; onDone?: (() => void) | undefined }>
) {
  const { nameOf } = useStockLookup()
  const latest = useLatestIntents(trades)
  const stages = latest.map(stageOf)
  const lead = tradeOutcome(stages[0]!, latest[0]!.leg.side, describeLeg(latest[0]!.leg, nameOf))
  const settled = stages.every((stage) => stage === "filled" || stage === "failed")

  return (
    <div className="grid gap-3">
      <Outcome
        tone={lead.tone}
        title={lead.title}
        description={latest.length === 1 ? lead.description : "Sent together with one Face ID."}
        actions={settled && onDone !== undefined ?
          <Button variant="secondary" className="w-full" onClick={onDone}>Done</Button> :
          undefined}
      />
      {latest.length === 1 ? null : (
        <ul className="grid gap-1.5">
          {latest.map((intent, index) => {
            const text = tradeOutcome(stages[index]!, intent.leg.side, describeLeg(intent.leg, nameOf))
            return (
              <li key={intent.id} className="flex items-center gap-2 text-label">
                <Icon
                  name={text.tone === "success" ? "check-circle" : text.tone === "failure" ? "error" : "clock"}
                  size={14}
                  className={cn(
                    text.tone === "success" ? "text-gain" : text.tone === "failure" ? "text-loss" : "text-g-400"
                  )}
                />
                {text.title}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * The body of an agent's trade waiting for you, the same on the approvals page, in the sheet and in a chat's trade
 * card: every trade one Face ID sends (price now, what each gets, its step in a plan), why it needs you, when the
 * approval runs out, and Approve with Face ID or Decline (for all of them). Once approved it follows each trade sent
 * to its end; declined, it says nothing moved. A Face ID you close is a quiet note, and the approval waits on.
 */
export function ApprovalBody(
  { approval, together, now, onHandled, onDone }: Readonly<{
    approval: Approval
    together: ReadonlyArray<Intent>
    now: Date
    /** Approve or Decline was pressed: the caller may keep the card until Done. */
    onHandled?: () => void
    onDone?: () => void
  }>
) {
  const { approve, decline, flow, intent } = approval
  const trades = [intent, ...together]
  const busy = flow.status === "preparing" || flow.status === "signing" || flow.status === "declining"

  if (flow.status === "approved") return <Sent trades={trades} onDone={onDone} />
  if (flow.status === "declined") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label-sm text-g-600">{nothingMoved(intent.leg.side)}</p>
        {onDone === undefined ? null : <Button variant="secondary" size="sm" onClick={onDone}>Done</Button>}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <Trades trades={trades} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label-sm text-g-600">
          {intent.decision === null ? "It needs your Face ID." : describeDecision(intent.decision)} Asked at{" "}
          {clockTime(intent.createdAt)}.
        </span>
        {intent.expiresAt === null ?
          null :
          <StatusPill tone="attention" icon="clock">{expiresIn(intent.expiresAt, now)}</StatusPill>}
      </div>

      {flow.status === "failed" ?
        (
          <Alert variant="destructive">
            <AlertDescription>{flow.message}</AlertDescription>
          </Alert>
        ) :
        flow.status === "cancelled" ?
        <output className="block text-label-sm text-g-600">{flow.message}</output> :
        null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          loading={flow.status === "declining"}
          disabled={busy}
          onClick={() => {
            onHandled?.()
            void decline()
          }}
        >
          {together.length === 0 ? "Decline" : "Decline all"}
        </Button>
        <Button
          size="sm"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => {
            onHandled?.()
            void approve()
          }}
        >
          {flow.status === "preparing" || flow.status === "signing" ?
            <Spinner size={14} /> :
            <Icon name="face-id" size={14} />}
          <TextMorph>
            {flow.status === "signing" ?
              "Waiting for Face ID…" :
              together.length === 0 ?
              "Approve with Face ID" :
              `Approve ${together.length + 1} trades with Face ID`}
          </TextMorph>
        </Button>
      </div>
    </div>
  )
}
