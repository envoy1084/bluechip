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
import { TransactionStatus, type TransactionStep } from "./transaction-status.tsx"

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
  /** Why it needs you. Defaults to "This trade is over your ask-me amount, so it needs your OK." */
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

const STEP_OF: Partial<Record<ApprovalState, "sending" | "confirming" | "filled" | "failed">> = {
  approved: "sending",
  sending: "sending",
  confirming: "confirming",
  filled: "filled",
  failed: "failed"
}

/**
 * A trade over your ask-me amount, waiting for you: the order, Approve with Face ID and Decline. After you approve,
 * the Face ID seal forms and the same card follows the trade until it fills, with a sweep when it does. The title
 * morphs from step to step, and phones get a success haptic when Face ID passes and when the trade fills. Use
 * `ApprovalSheet` to show it in a bottom sheet.
 */
export function ApprovalCard(
  { agentName, order, reason, onApprove, onDecline, onDone, className }: ApprovalCardProps
) {
  const titleId = useId()
  const [state, setState] = useState<ApprovalState>("pending")
  const [faceIdFailed, setFaceIdFailed] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [failedAt, setFailedAt] = useState<TransactionStep>("sending")
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
      setFailedAt(step === "confirming" ? "confirming" : "sending")
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
  const verb = order.side === "buy" ? "Bought" : "Sold"
  const [title, description] = {
    pending: [`Approve ${agentName}'s trade`, reason ?? "This trade is over your ask-me amount, so it needs your OK."],
    approving: [
      `Approve ${agentName}'s trade`,
      reason ?? "This trade is over your ask-me amount, so it needs your OK."
    ],
    declining: [
      `Approve ${agentName}'s trade`,
      reason ?? "This trade is over your ask-me amount, so it needs your OK."
    ],
    approved: ["Approved", "Sending your trade to Base."],
    sending: ["Approved", "Sending your trade to Base."],
    confirming: ["Confirming", "This takes a couple of seconds."],
    filled: [
      `${verb} ${formatMoney(order.amount)} of ${order.name}`,
      `${shares} shares at ${formatMoney(order.price)}. It's in your portfolio.`
    ],
    failed: [
      "Trade didn't go through",
      failure ??
        `The price moved more than 1% while confirming, so nothing was ${order.side === "buy" ? "bought" : "sold"}. ${
          order.side === "buy" ? `Your ${formatMoney(order.amount)} is still cash.` : "Your shares are where they were."
        }`
    ],
    declined: [
      "Declined",
      `Nothing was ${order.side === "buy" ? "bought" : "sold"}. ${agentName} won't ask about this trade again.`
    ]
  }[state]

  const deciding = state === "pending" || state === "approving" || state === "declining"
  const finished = state === "filled" || state === "failed" || state === "declined"
  const step = STEP_OF[state]
  const sealed = step !== undefined && state !== "failed"

  return (
    <section
      data-slot="approval-card"
      data-state={state}
      aria-labelledby={titleId}
      className={cn("relative grid w-full gap-3.5 text-center", className)}
    >
      <div
        aria-hidden
        className={cn(
          "grid place-items-center justify-self-center text-white transition-[width,height,background,box-shadow] duration-slow ease-brand",
          sealed ?
            "size-24 rounded-2xl bg-white shadow-[0_0_0_1px_rgba(10,11,13,.08),0_10px_22px_-8px_rgba(42, 91, 255,.3)]" :
            "size-[60px] rounded-[18px]",
          deciding &&
            "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_10px_22px_-8px_rgba(42, 91, 255,.55)]",
          state === "approving" && "animate-pulse",
          state === "failed" &&
            "bg-[linear-gradient(180deg,#f25e3e,var(--color-loss))] shadow-[0_10px_22px_-8px_rgba(217,58,28,.5)]",
          state === "declined" &&
            "bg-[linear-gradient(180deg,#fff,#eef0f3)] text-g-500 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.1)]"
        )}
      >
        {sealed ? <Seal playing className="size-[88px]" /> : <Icon name={deciding ? "face-id" : "close"} size={28} />}
      </div>
      <div aria-live="polite" className="grid gap-1.5">
        <h3 id={titleId} className="text-[19px] font-semibold tracking-[-0.02em]">
          <TextMorph>{title}</TextMorph>
        </h3>
        <p className="max-w-[36ch] justify-self-center text-body-sm text-g-600">{description}</p>
      </div>
      {deciding && <TradeOrderPreview order={order} />}
      {step !== undefined && (
        <div className="rounded-[12px] p-3.5 text-left surface-well">
          <TransactionStatus
            state={step}
            orientation="vertical"
            failedAt={failedAt}
            {...(failure === null ? {} : { failureReason: failure })}
          />
        </div>
      )}
      {deciding && (
        <>
          <Button
            size="lg"
            className="w-full"
            aria-busy={state === "approving" || undefined}
            disabled={state !== "pending"}
            onClick={approve}
          >
            {state === "approving" ? <Spinner size={18} /> : <Icon name="face-id" size={18} />}
            <TextMorph>
              {state === "approving" ?
                "Waiting for Face ID…" :
                faceIdFailed ?
                "Try Face ID again" :
                "Approve with Face ID"}
            </TextMorph>
          </Button>
          {faceIdFailed && (
            <p role="alert" className="-mt-1.5 text-label-sm text-loss">Face ID didn't work. Try again.</p>
          )}
          <Button
            variant="secondary"
            className="w-full"
            loading={state === "declining"}
            disabled={state === "approving"}
            onClick={decline}
          >
            Decline
          </Button>
        </>
      )}
      {finished && <Button variant="secondary" className="w-full" onClick={onDone}>Done</Button>}
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
