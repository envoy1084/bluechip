import { describeDecision, describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { priceDollars, shareCount, usdcDollars } from "../../../../lib/amounts.ts"
import { nothingMoved, tradeOutcome, type TradeStage } from "../../../../lib/tradeOutcome.ts"
import { useApproveIntent } from "../../hooks/useApproveIntent.ts"
import { clockTime, expiresIn } from "../../model/intentText.ts"

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/** The price now and what the trade gets at it, when the stock has a price. */
function Estimate({ intent, stock }: Readonly<{ intent: Intent; stock: Stock | undefined }>) {
  const price = stock?.price?.price ?? stock?.reference?.price ?? null
  if (price === null) return null

  const { amount, side } = intent.leg
  const estimate = "usdc" in amount ?
    formatShareCount(shareCount(sharesFor(Usdc.make(amount.usdc), price))) :
    formatMoney(usdcDollars(valueOf(Shares.make(amount.shares), price)))

  return (
    <dl className="grid grid-cols-2 gap-2.5 border-y border-ink/5 bg-g-50 px-[18px] py-3">
      <div className="grid gap-0.5">
        <dt className="text-caption text-g-500">Price now</dt>
        <dd className="text-[13.5px] font-semibold tabular-nums">{formatMoney(priceDollars(price))} a share</dd>
      </div>
      <div className="grid gap-0.5">
        <dt className="text-caption text-g-500">{side === "buy" ? "You get about" : "You receive about"}</dt>
        <dd className="text-[13.5px] font-semibold tabular-nums">{estimate}</dd>
      </div>
    </dl>
  )
}

/** An approved trade: a short wait while Base takes it, then what it did, or that nothing moved. */
function Approved(
  { intent, trade, onDone }: Readonly<{ intent: Intent; trade: string; onDone: () => void }>
) {
  const stage: TradeStage = intent.status === "filled" || intent.status === "failed" ||
      intent.status === "confirming" ?
    intent.status :
    "sending"
  const text = tradeOutcome(stage, intent.leg.side, trade)

  return (
    <section aria-label={text.title} className="rounded-lg bg-white px-[18px] py-5 shadow-e2">
      <Outcome
        tone={text.tone}
        title={text.title}
        description={text.description}
        actions={stage === "filled" || stage === "failed" ?
          <Button variant="secondary" className="w-full" onClick={onDone}>Done</Button> :
          undefined}
      />
    </section>
  )
}

/** The other trades of the plan one Face ID sends with it, in one operation. */
function Together(
  { together, nameOf }: Readonly<{ together: ReadonlyArray<Intent>; nameOf: (symbol: StockSymbol) => string }>
) {
  if (together.length === 0) return null
  return (
    <div className="grid gap-1.5 border-b border-ink/5 px-[18px] py-3">
      <span className="text-caption text-g-500">Sent with it, in one Face ID</span>
      <ul className="grid gap-1">
        {together.map((intent) => (
          <li key={intent.id} className="flex items-center gap-2 text-[13.5px] font-medium">
            <Icon name="plus" size={13} className="text-g-400" />
            {describeLeg(intent.leg, nameOf)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * An agent's trade waiting for you: what it wants to do, why it needs you, when the request runs out, the trades of
 * its plan that go with it, and Approve with Face ID or Decline (for all of them). Once approved, the card turns into
 * the trade's end: what it bought or sold, or that nothing moved.
 */
export function ApprovalRequest(
  { intent: asked, together, agentName, now, stockOf, nameOf, onHandled, onDone }: Readonly<{
    intent: Intent
    together: ReadonlyArray<Intent>
    agentName: string
    now: Date
    stockOf: (symbol: StockSymbol) => Stock | undefined
    nameOf: (symbol: StockSymbol) => string
    /** Approve or Decline was pressed: keep the card until Done. */
    onHandled: () => void
    onDone: () => void
  }>
) {
  const { approve, decline, flow, intent } = useApproveIntent(asked, together)
  const trade = describeLeg(intent.leg, nameOf)
  const busy = flow.status === "preparing" || flow.status === "signing" || flow.status === "declining"

  if (flow.status === "approved") return <Approved intent={intent} trade={trade} onDone={onDone} />

  const title = flow.status === "declined" ?
    `You declined: ${lowerFirst(trade)}` :
    `${agentName} wants to ${lowerFirst(trade)}`
  const why = flow.status === "declined" ?
    nothingMoved(intent.leg.side) :
    `${intent.decision === null ? "It needs your Face ID." : describeDecision(intent.decision)} Asked at ${
      clockTime(intent.createdAt)
    }.`

  return (
    <section aria-label={title} className="overflow-hidden rounded-lg bg-white shadow-e2">
      <div className="flex flex-wrap items-center gap-3 px-[18px] py-4">
        <AgentAvatar agentId={intent.agentId ?? intent.id} size="lg" status="waiting" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <b className="text-[15px] font-semibold tracking-[-0.01em]">
            <TextMorph>{title}</TextMorph>
          </b>
          <span className="text-label-sm text-g-500">{why}</span>
        </div>
        {flow.status === "declined" || intent.expiresAt === null ?
          null :
          <StatusPill tone="attention" icon="clock">{expiresIn(intent.expiresAt, now)}</StatusPill>}
      </div>

      {flow.status === "declined" ?
        (
          <div className="flex justify-end border-t border-ink/5 px-[18px] py-3">
            <Button variant="secondary" size="sm" onClick={onDone}>Done</Button>
          </div>
        ) :
        null}

      {flow.status === "declined" ? null : (
        <>
          <Estimate intent={intent} stock={stockOf(intent.leg.symbol)} />
          <Together together={together} nameOf={nameOf} />
          {flow.status === "failed" ?
            (
              <div className="px-[18px] pt-3">
                <Alert variant="destructive">
                  <AlertDescription>{flow.message}</AlertDescription>
                </Alert>
              </div>
            ) :
            null}
          <div className="flex flex-wrap items-center justify-end gap-2 px-[18px] py-3">
            <Button
              variant="ghost"
              size="sm"
              loading={flow.status === "declining"}
              disabled={busy}
              onClick={() => {
                onHandled()
                void decline()
              }}
            >
              Decline
            </Button>
            <Button
              size="sm"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => {
                onHandled()
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
        </>
      )}
    </section>
  )
}
