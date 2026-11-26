import type { ReactNode } from "react"
import { ChatCard, ChatCardHeadline, ChatCardNote, ChatCardProblem } from "./chat-card.tsx"

const NONE: ReadonlyArray<string> = []

export interface TradeApprovalCardProps {
  /** The trade: "Buy $50.00 of Apple". */
  readonly title: string
  /** What it gets at the quoted price: "About 0.26 shares at $190.62 each". */
  readonly detail: string
  /** Why the assistant suggests it, in its words. */
  readonly reason?: string
  /** What to look at twice: prices paused, the pool far from Chainlink. */
  readonly warnings?: ReadonlyArray<string>
  /** Its first transaction also sets the account up on Base. */
  readonly setsUpAccount?: boolean
  /** Exactly what it does at the quoted price, under the title: an order preview. */
  readonly preview?: ReactNode
  /** The Face ID button. */
  readonly action: ReactNode
  readonly problem?: string | null
}

/**
 * Your own trade from chat, prepared for Face ID: the trade, what it gets, why, anything to look at twice, and the
 * one button. Nothing happens unless you approve it.
 */
export function TradeApprovalCard(
  { title, detail, reason, warnings = NONE, setsUpAccount = false, preview, action, problem }: TradeApprovalCardProps
) {
  return (
    <ChatCard tag="Your trade" icon="face-id" state="Needs Face ID" footer={action}>
      <ChatCardHeadline title={title} detail={detail} />
      {preview}
      {reason === undefined || reason === "" ? null : <p className="text-[13.5px] text-g-700">{reason}</p>}
      {warnings.map((warning) => <ChatCardNote key={warning} icon="warning" tone="warn">{warning}</ChatCardNote>)}
      {setsUpAccount ?
        <ChatCardNote icon="info">It also sets up your account on Base, its first transaction.</ChatCardNote> :
        null}
      <ChatCardNote icon="shield">Nothing happens unless you approve it.</ChatCardNote>
      <ChatCardProblem>{problem}</ChatCardProblem>
    </ChatCard>
  )
}
