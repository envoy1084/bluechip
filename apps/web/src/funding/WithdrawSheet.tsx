import type { Address, RequestId } from "@bluechip/domain/Ids"
import type { Usdc } from "@bluechip/domain/market/Units"
import type { SigningRequest, Transfer } from "@bluechip/domain/portfolio/Transfer"
import { shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { MoneyInput } from "@bluechip/ui/bluechip/money-input"
import { OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@bluechip/ui/components/sheet"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { confirmWithdrawalAtom, prepareWithdrawalAtom, withdrawalsAtom } from "../atoms/portfolio.ts"
import { parseUsdc, usdcDollars } from "../market/amounts.ts"

type Step =
  | { readonly _tag: "Form" }
  | { readonly _tag: "Review"; readonly request: SigningRequest }
  | { readonly _tag: "Sent"; readonly transfer: Transfer }

const isAddress = (text: string) => /^0x[0-9a-fA-F]{40}$/.test(text)

/** Why preparing failed, in words; the server names the field or the cash left. */
const prepareProblem = (error: unknown): string => {
  const tag = (error as { readonly _tag?: string })._tag
  if (tag === "InsufficientCash") return "That's more than your cash."
  if (tag === "InvalidRequest") return "That address can't receive a withdrawal. Check it and try again."
  return "We couldn't prepare this withdrawal. Try again in a moment."
}

/**
 * Takes USDC out to any address on Base: amount and address, a review of exactly what Face ID approves (and that the
 * first withdrawal also sets up the account), then where it stands until Base confirms it.
 */
export function WithdrawSheet(
  { cash, open, onOpenChange }: Readonly<{ cash: bigint; open: boolean; onOpenChange: (open: boolean) => void }>
) {
  const [step, setStep] = useState<Step>({ _tag: "Form" })
  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) setStep({ _tag: "Form" })
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Withdraw cash</SheetTitle>
          <SheetDescription>Send USDC from your account to an address on Base.</SheetDescription>
        </SheetHeader>
        <SheetBody className="grid content-start gap-4">
          {step._tag === "Form" && (
            <WithdrawForm
              cash={cash}
              onPrepared={(request) => setStep({ _tag: "Review", request })}
            />
          )}
          {step._tag === "Review" && (
            <WithdrawReview
              request={step.request}
              onBack={() => setStep({ _tag: "Form" })}
              onSent={(transfer) => setStep({ _tag: "Sent", transfer })}
            />
          )}
          {step._tag === "Sent" && <WithdrawProgress transfer={step.transfer} onDone={() => close(false)} />}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function WithdrawForm(
  { cash, onPrepared }: Readonly<{ cash: bigint; onPrepared: (request: SigningRequest) => void }>
) {
  const prepare = useAtomSet(prepareWithdrawalAtom, { mode: "promise" })
  const [amount, setAmount] = useState<Usdc | null>(null)
  const [to, setTo] = useState("")
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // One id per withdrawal being prepared: a retried request returns the same one instead of preparing another.
  const [requestId] = useState(() => crypto.randomUUID())

  const addressProblem = to !== "" && !isAddress(to.trim())
  const ready = amount !== null && amount <= cash && isAddress(to.trim())

  const submit = () => {
    if (!ready) return
    setPreparing(true)
    setProblem(null)

    prepare({ payload: { requestId: requestId as RequestId, to: to.trim() as Address, amount } }).then(
      onPrepared,
      (error) => setProblem(prepareProblem(error))
    ).finally(() => setPreparing(false))
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <MoneyInput
        label="Amount"
        currency="usdc"
        available={usdcDollars(cash)}
        showMax
        emptyHint={`You have ${formatMoney(usdcDollars(cash))} in cash.`}
        onValueChange={(value) => setAmount(value === null ? null : parseUsdc(String(value)))}
      />

      <label className="grid gap-1.5">
        <span className="text-[13.5px] font-medium">To this address on Base</span>
        <Input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={addressProblem}
          className="font-mono"
        />
        <span className={addressProblem ? "text-caption text-loss" : "text-caption text-g-500"}>
          {addressProblem ?
            "That isn't a Base address: 0x and 40 letters or digits." :
            "Only send to an address that accepts USDC on Base. Sends can't be undone."}
        </span>
      </label>

      {problem !== null && (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={!ready} loading={preparing}>Review withdrawal</Button>
    </form>
  )
}

function WithdrawReview(
  { request, onBack, onSent }: Readonly<{
    request: SigningRequest
    onBack: () => void
    onSent: (transfer: Transfer) => void
  }>
) {
  const confirm = useAtomSet(confirmWithdrawalAtom, { mode: "promise" })
  const { amount, to } = request.withdrawal

  return (
    <div className="grid gap-4">
      <OrderPreview>
        <OrderPreviewRow label="You send">{formatMoney(usdcDollars(amount))} USDC</OrderPreviewRow>
        <OrderPreviewRow label="To">
          <span className="font-mono">{shortAddress(to)}</span>
        </OrderPreviewRow>
        <OrderPreviewRow label="Network">Base</OrderPreviewRow>
      </OrderPreview>

      {request.deploysAccount && (
        <Alert variant="info">
          <AlertDescription>
            This is your account's first transaction on Base, so it also sets the account up. You only do this once.
          </AlertDescription>
        </Alert>
      )}

      <PasskeyButton
        size="lg"
        doneLabel="Sent"
        onAuthenticate={() => confirm({ id: request.id, options: request.options }).then(onSent)}
      >
        Withdraw with Face ID
      </PasskeyButton>
      <Button variant="ghost" onClick={onBack}>Change amount or address</Button>
    </div>
  )
}

function WithdrawProgress({ transfer, onDone }: Readonly<{ transfer: Transfer; onDone: () => void }>) {
  const withdrawals = useAtomValue(withdrawalsAtom)
  // The list refetches on each `TransferUpdated` event, so it holds this withdrawal's latest status.
  const latest = AsyncResult.isSuccess(withdrawals) ?
    withdrawals.value.items.find((item) => item.id === transfer.id) ?? transfer :
    transfer

  const state = latest.status === "confirmed" ? "filled" : latest.status === "failed" ? "failed" : "confirming"

  return (
    <div className="grid gap-4">
      <TransactionStatus
        kind="withdrawal"
        state={state}
        orientation="vertical"
        failureReason="Base didn't accept it. Your cash is still in your account."
      />
      {latest.txHash !== null && (
        <a
          href={`https://basescan.org/tx/${latest.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-label-sm font-medium text-blue hover:underline"
        >
          View on BaseScan
        </a>
      )}
      <Button variant="secondary" onClick={onDone}>{state === "confirming" ? "Close, it keeps going" : "Done"}</Button>
    </div>
  )
}
