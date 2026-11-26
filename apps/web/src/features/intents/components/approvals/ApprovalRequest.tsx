import { describeDecision, describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { priceDollars, shareCount, usdcDollars } from "../../../../lib/amounts.ts"
import { useApproveIntent } from "../../hooks/useApproveIntent.ts"
import { clockTime, expiresIn, nothingMoved } from "../../model/intentText.ts"

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

/** Where an approved trade is on Base, then what it did. */
function Approved({ intent, onDone }: Readonly<{ intent: Intent; onDone: () => void }>) {
  const ended = intent.status === "filled" || intent.status === "failed"
  const state = intent.status === "confirming" || intent.status === "filled" || intent.status === "failed" ?
    intent.status :
    "sending"

  return (
    <div className="grid gap-3 border-t border-ink/5 px-[18px] py-3.5">
      <TransactionStatus
        state={state}
        orientation="vertical"
        failureReason={`Base didn't take it. ${nothingMoved(intent.leg.side)}`}
      />
      {ended ? <Button variant="secondary" className="justify-self-end" onClick={onDone}>Done</Button> : null}
    </div>
  )
}

/**
 * An agent's trade waiting for you: what it wants to do, why it needs you, when the request runs out, and Approve with
 * Face ID or Decline. Once approved, the card follows the trade on Base until it fills.
 */
export function ApprovalRequest(
  { intent: asked, agentName, now, stockOf, nameOf, onHandled, onDone }: Readonly<{
    intent: Intent
    agentName: string
    now: Date
    stockOf: (symbol: StockSymbol) => Stock | undefined
    nameOf: (symbol: StockSymbol) => string
    /** Approve or Decline was pressed: keep the card until Done. */
    onHandled: () => void
    onDone: () => void
  }>
) {
  const { approve, decline, flow, intent } = useApproveIntent(asked)
  const trade = describeLeg(intent.leg, nameOf)
  const busy = flow.status === "preparing" || flow.status === "signing" || flow.status === "declining"

  const title = flow.status === "approved" ?
    intent.status === "filled" ?
      trade.replace(/^Buy/, "Bought").replace(/^Sell/, "Sold") :
      intent.status === "failed" ?
      `${trade} didn't go through` :
      `Approved. Sending ${agentName}'s trade` :
    flow.status === "declined" ?
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
        {flow.status === "approved" || flow.status === "declined" || intent.expiresAt === null ?
          null :
          (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-wash px-2 py-px text-[11.5px] font-semibold whitespace-nowrap text-warn">
              <Icon name="clock" size={13} />
              {expiresIn(intent.expiresAt, now)}
            </span>
          )}
      </div>

      {flow.status === "approved" ? <Approved intent={intent} onDone={onDone} /> : null}

      {flow.status === "declined" ?
        (
          <div className="flex justify-end border-t border-ink/5 px-[18px] py-3">
            <Button variant="secondary" size="sm" onClick={onDone}>Done</Button>
          </div>
        ) :
        null}

      {flow.status === "approved" || flow.status === "declined" ? null : (
        <>
          <Estimate intent={intent} stock={stockOf(intent.leg.symbol)} />
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
              <TextMorph>{flow.status === "signing" ? "Waiting for Face ID…" : "Approve with Face ID"}</TextMorph>
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
