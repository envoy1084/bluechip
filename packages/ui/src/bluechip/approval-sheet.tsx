import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { Button } from "../components/button.tsx"
import { Drawer, DrawerContent } from "../components/drawer.tsx"
import { Spinner } from "../components/spinner.tsx"
import { TextMorph } from "../components/text-morph.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { haptic } from "../lib/haptics.ts"
import { Seal } from "../motion/seal.tsx"
import { MomentScope, useMoment } from "../motion/sweep.tsx"
import { type TradeOrder, TradeOrderPreview } from "./order-preview.tsx"
import { Outcome } from "./outcome.tsx"

/** Where an approval is, from the moment it waits for you until the trade fills, fails or you decline it. */
export type ApprovalState =
  | "pending"
  | "approving"
  | "approved"
  | "sending"
  | "confirming"
  | "filled"
  | "failed"
  | "declining"
  | "declined"

/** What `onApprove` reports as the trade moves: Face ID passed, then each step on Base. */
export type ApprovalProgress = "approved" | "sending" | "confirming"

export interface ApprovalCardProps {
  readonly agentName: string
  readonly order: TradeOrder
  /** Why it needs you. Defaults to "This trade is over your ask-me amount, so it needs your approval." */
  readonly reason?: ReactNode
  /**
   * Asks for Face ID, then sends the trade. Call `progress("approved")` once Face ID passes, then `"sending"` and
   * `"confirming"`. Resolve when the trade fills. Reject before `"approved"` when Face ID fails (you can try again),
   * after it when the trade fails (the error's message is shown as the reason).
   */
  readonly onApprove: (progress: (step: ApprovalProgress) => void) => Promise<void>
  /** Declines the trade. Resolve once it's recorded. */
  readonly onDecline: () => Promise<void>
  /** The Done button after the trade fills, fails or is declined. */
  readonly onDone?: () => void
  readonly className?: string
}

/**
 * A trade over your ask-me amount, waiting for you: what the agent wants, the order, Approve with Face ID and Decline.
 * After you approve, the Face ID seal forms while Base takes the trade (a couple of seconds), then the card says what
 * it bought or sold, with a sweep, or that nothing moved. Phones get a success haptic when Face ID passes and when the
 * trade fills. Use `ApprovalSheet` to show it in a bottom sheet.
 */
export function ApprovalCard(
  { agentName, order, reason, onApprove, onDecline, onDone, className }: ApprovalCardProps
) {
  const titleId = useId()
  const [state, setState] = useState<ApprovalState>("pending")
  const [faceIdFailed, setFaceIdFailed] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const run = useRef(0)
  const { ref: momentRef, play: playMoment } = useMoment()
  useEffect(() => () => void run.current++, [])

  const approve = () => {
    const id = ++run.current
    let approved = false
    setState("approving")
    setFaceIdFailed(false)
    onApprove((step) => {
      if (id !== run.current) return
      if (!approved) haptic("success")
      approved = true
      setState(step)
    }).then(
      () => {
        if (id !== run.current) return
        haptic("success")
        playMoment(() => setState("filled"))
      },
      (error: unknown) => {
        if (id !== run.current) return
        if (!approved) {
          setState("pending")
          setFaceIdFailed(true)
          return
        }
        setFailure(error instanceof Error && error.message !== "" ? error.message : null)
        setState("failed")
      }
    )
  }

  const decline = () => {
    const id = ++run.current
    setState("declining")
    onDecline().then(
      () => {
        if (id === run.current) setState("declined")
      },
      () => {
        if (id === run.current) setState("pending")
      }
    )
  }

  const shares = (order.amount / order.price).toFixed(3)
  const nothing = order.side === "buy" ?
    `Nothing was bought. Your ${formatMoney(order.amount)} is still cash.` :
    "Nothing was sold. Your shares are where they were."
  const what = `${formatMoney(order.amount)} of ${order.name}`
  const deciding = state === "pending" || state === "approving" || state === "declining"
  const ask = reason ?? "It's over your ask-me amount, so it needs your approval."

  if (deciding) {
    return (
      <section
        data-slot="approval-card"
        data-state={state}
        aria-labelledby={titleId}
        className={cn("relative grid w-full gap-3.5 text-center", className)}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-[52px] place-items-center justify-self-center rounded-[16px] text-white",
            "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_6px_14px_-6px_rgba(42,91,255,.3)]",
            state === "approving" && "animate-pulse"
          )}
        >
          <Icon name="face-id" size={26} />
        </span>
        <div className="grid gap-1">
          <h3 id={titleId} className="text-[19px] font-semibold tracking-[-0.02em]">
            {agentName} wants to {order.side} {what}
          </h3>
          <p className="max-w-[36ch] justify-self-center text-body-sm text-g-600">{ask}</p>
        </div>
        <TradeOrderPreview order={order} />
        <Button
          size="lg"
          className="w-full"
          aria-busy={state === "approving" || undefined}
          disabled={state !== "pending"}
          onClick={approve}
        >
          {state === "approving" ? <Spinner size={18} /> : <Icon name="face-id" size={18} />}
          <TextMorph>
            {state === "approving"
              ? "Waiting for Face ID…"
              : faceIdFailed
              ? "Try Face ID again"
              : "Approve with Face ID"}
          </TextMorph>
        </Button>
        {faceIdFailed && (
          <p role="alert" className="-mt-1.5 text-label-sm text-loss">Face ID didn't work. Try again.</p>
        )}
        <Button
          variant="ghost"
          className="w-full"
          loading={state === "declining"}
          disabled={state === "approving"}
          onClick={decline}
        >
          Decline
        </Button>
      </section>
    )
  }

  const ended = state === "filled" || state === "failed" || state === "declined"
  const [tone, title, description] = state === "filled" ?
    [
      "success",
      `${order.side === "buy" ? "Bought" : "Sold"} ${what}`,
      `${shares} shares at ${formatMoney(order.price)}. ${
        order.side === "buy" ? "It's in your portfolio." : "The cash is in your account."
      }`
    ] as const :
    state === "failed" ?
    [
      "failure",
      `${agentName}'s trade didn't go through`,
      failure ?? `The price moved more than 1%. ${nothing}`
    ] as const :
    state === "declined" ?
    ["neutral", "Declined", `${nothing.split(". ")[0]}. ${agentName} won't ask about this trade again.`] as const :
    [
      "pending",
      `${order.side === "buy" ? "Buying" : "Selling"} ${what}`,
      "Approved. Base confirms it in a couple of seconds."
    ] as const

  return (
    <section
      data-slot="approval-card"
      data-state={state}
      aria-labelledby={titleId}
      className={cn("relative grid w-full", className)}
    >
      <Outcome
        tone={tone}
        title={<span id={titleId}>{title}</span>}
        description={description}
        // Face ID passed: the seal forms while Base takes the trade, then the check takes its place.
        media={tone === "pending" ? <Seal playing label="Approved with Face ID" className="mb-1 size-16" /> : undefined}
        actions={ended ? <Button variant="secondary" className="w-full" onClick={onDone}>Done</Button> : undefined}
      />
      <MomentScope ref={momentRef} direction="btt" />
    </section>
  )
}

export interface ApprovalSheetProps extends ApprovalCardProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

/** The approval card in a bottom sheet. Swipe down, tap outside or press Esc to decide later. */
export function ApprovalSheet({ open, onOpenChange, ...props }: ApprovalSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-label="Approve a trade" className="max-w-[440px]">
        <ApprovalCard {...props} />
      </DrawerContent>
    </Drawer>
  )
}
