import type { Card } from "@bluechip/domain/assistant/Card"
import type { RequestId } from "@bluechip/domain/Ids"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import { type Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
import type { TradeWarning } from "@bluechip/domain/trading/Trade"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { priceDollars, shareCount } from "../../../../lib/amounts.ts"
import { liveIntentsAtom } from "../../../../lib/api/events.ts"
import { tradeProblem } from "../../../../lib/tradeProblem.ts"
import { confirmIntentAtom, prepareIntentAtom } from "../../atoms/assistant.ts"
import { hasExpired } from "../../model/cardText.ts"
import { CardFrame, CardProblem } from "./CardFrame.tsx"
import type { CardViews } from "./CardViews.ts"

const WARNING: Readonly<Record<TradeWarning, string>> = {
  pricesPaused: "The market is closed, so prices are paused. It trades at the pool's price.",
  marketApart: "The pool's price is further from Chainlink's than usual."
}

/**
 * Your own trade, prepared for Face ID: nothing happens unless you approve it here. A request that ran out (after two
 * minutes) is prepared again with a fresh quote when you approve. Once signed, the trade follows Base live.
 */
export function ApprovalCard(
  { card, nameOf, Trade }: Readonly<{ card: Extract<Card, { _tag: "Approval" }> } & CardViews>
) {
  const prepare = useAtomSet(prepareIntentAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmIntentAtom, { mode: "promise" })
  const [request, setRequest] = useState(card.request)
  const [signed, setSigned] = useState<Intent | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const live = useAtomValue(liveIntentsAtom).get(request.intent.id)
  const { intent, quote } = request

  // Signed here or in another tab: the trade is on its way, so show where it is.
  const moved = live !== undefined && live.status !== "awaitingSignature"
  if (signed !== null || moved) {
    return (
      <div className="w-full max-w-[560px] rounded-lg bg-white p-[18px] shadow-e2">
        <Trade intent={signed ?? live!} nameOf={nameOf} />
      </div>
    )
  }

  const approve = async () => {
    setProblem(null)
    try {
      let ready = request
      if (hasExpired(request.expiresAt)) {
        const prepared = await prepare({
          payload: {
            requestId: crypto.randomUUID() as RequestId,
            agentId: null,
            leg: intent.leg,
            reason: intent.reason
          }
        })
        if (!(prepared instanceof IntentRequest)) return setSigned(prepared)
        ready = prepared
        setRequest(prepared)
      }
      setSigned(await confirm({ id: ready.id, options: ready.options }))
    } catch (error) {
      setProblem(tradeProblem(error, intent.leg.side))
      throw error
    }
  }

  return (
    <CardFrame
      tag="Your trade"
      icon="face-id"
      state="Waiting for your Face ID"
      footer={
        <PasskeyButton doneLabel="Sent" onAuthenticate={approve}>
          {intent.leg.side === "buy" ? "Buy with Face ID" : "Sell with Face ID"}
        </PasskeyButton>
      }
    >
      <div className="grid gap-1">
        <b className="text-[15px] font-semibold">{describeLeg(intent.leg, nameOf)}</b>
        <span className="text-label-sm text-g-500">
          About {formatShareCount(shareCount(quote.shares))} at {formatMoney(priceDollars(quote.price))} each
        </span>
      </div>
      {intent.reason === "" ? null : <p className="text-[13.5px] text-g-700">{intent.reason}</p>}
      {request.warnings.map((warning) => (
        <p key={warning} className="inline-flex items-start gap-1.5 text-label-sm font-[550] text-warn">
          <Icon name="warning" size={14} className="mt-px shrink-0" />
          {WARNING[warning]}
        </p>
      ))}
      {request.deploysAccount ?
        <p className="text-label-sm text-g-500">This also sets up your account on Base, its first transaction.</p> :
        null}
      <p className="inline-flex items-center gap-1.5 text-label-sm text-g-600">
        <Icon name="shield" size={14} />
        Nothing happens unless you approve it.
      </p>
      <CardProblem message={problem} />
    </CardFrame>
  )
}
