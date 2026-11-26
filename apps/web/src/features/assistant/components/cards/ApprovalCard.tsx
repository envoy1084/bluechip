import type { Card } from "@bluechip/domain/assistant/Card"
import type { RequestId } from "@bluechip/domain/Ids"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import { type Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
import type { TradeWarning } from "@bluechip/domain/trading/Trade"
import { ChatCard } from "@bluechip/ui/bluechip/chat-card"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { TradeApprovalCard } from "@bluechip/ui/bluechip/trade-approval-card"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { QuoteSummary } from "../../../../components/trading/QuoteSummary.tsx"
import { liveIntentsAtom } from "../../../../lib/api/events.ts"
import { tradeProblem } from "../../../../lib/tradeProblem.ts"
import { confirmIntentAtom, prepareIntentAtom } from "../../atoms/assistant.ts"
import { hasExpired } from "../../model/cardText.ts"
import type { CardViews } from "./CardViews.ts"

const WARNING: Readonly<Record<TradeWarning, string>> = {
  pricesPaused: "The market is closed, so prices are paused. It trades at the pool's price.",
  marketApart: "The pool's price is further from Chainlink's than usual."
}

/**
 * Your own trade, prepared for Face ID, with exactly what it does at the quoted price (what you pay and get, the fair
 * price check): nothing happens unless you approve it here. A request that ran out (after two
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
      <ChatCard tag="Your trade" icon="face-id" tone="quiet">
        <Trade intent={signed ?? live!} nameOf={nameOf} />
      </ChatCard>
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
    <TradeApprovalCard
      title={describeLeg(intent.leg, nameOf)}
      detail="At the pool's price now, checked against Chainlink's"
      preview={<QuoteSummary stock={{ symbol: intent.leg.symbol, name: nameOf(intent.leg.symbol) }} quote={quote} />}
      reason={intent.reason}
      warnings={request.warnings.map((warning) => WARNING[warning])}
      setsUpAccount={request.deploysAccount}
      problem={problem}
      action={
        <PasskeyButton doneLabel="Sent" onAuthenticate={approve}>
          {intent.leg.side === "buy" ? "Buy with Face ID" : "Sell with Face ID"}
        </PasskeyButton>
      }
    />
  )
}
