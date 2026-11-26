import { OrderPreview, OrderPreviewRow, TradeOrderPreview } from "@bluechip/ui/bluechip/order-preview"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { Demo, Section, States } from "../agents/layout.tsx"
import { cancelled, faceId, wait } from "../cards/data.ts"

const BUY = { side: "buy", symbol: "AAPL", name: "Apple", amount: 50, price: 190.62, fee: 0.03 } as const

export function BeforeYouSignSection() {
  return (
    <Section
      title="Before you sign"
      purpose="Exactly what Face ID approves, in rows: what moves, at what price, the fair price check and the fee. One primary action, and a quiet way back."
    >
      <States>
        <Demo label="A buy">
          <div className="grid w-full gap-3">
            <TradeOrderPreview order={BUY} />
            <PasskeyButton size="lg" doneLabel="Sent" onAuthenticate={faceId}>Buy with Face ID</PasskeyButton>
          </div>
        </Demo>
        <Demo label="A withdrawal">
          <div className="grid w-full gap-3">
            <OrderPreview>
              <OrderPreviewRow label="You send">$150.00 USDC</OrderPreviewRow>
              <OrderPreviewRow label="To">
                <span className="font-mono">0x12ab…9f3e</span>
              </OrderPreviewRow>
              <OrderPreviewRow label="Network">Base</OrderPreviewRow>
            </OrderPreview>
            <Alert variant="info">
              <AlertDescription>
                This is your account's first transaction on Base, so it also sets the account up.
              </AlertDescription>
            </Alert>
            <PasskeyButton size="lg" doneLabel="Sent" onAuthenticate={faceId}>Withdraw with Face ID</PasskeyButton>
            <Button variant="ghost">Change amount or address</Button>
          </div>
        </Demo>
        <Demo label="Locking an agent">
          <div className="grid w-full gap-3">
            <WorstCaseCard>
              On its worst day, this agent could make <b>12 trades</b> of up to <b>$100</b> each, spending at most{" "}
              <b>$250</b> on buys, only in Nvidia and Apple. It can never move money out of your account.
            </WorstCaseCard>
            <OrderPreview>
              <OrderPreviewRow label="Runs for">90 days, until 24 Feb</OrderPreviewRow>
              <OrderPreviewRow label="Asks you">Before trades over $100</OrderPreviewRow>
              <OrderPreviewRow label="You can">Pause it any time, instantly</OrderPreviewRow>
            </OrderPreview>
            <PasskeyButton size="lg" doneLabel="Sent" onAuthenticate={faceId}>
              Lock these rules with Face ID
            </PasskeyButton>
          </div>
        </Demo>
        <Demo label="Removing an agent">
          <section className="grid w-full gap-2.5 rounded-lg bg-[linear-gradient(180deg,#fff,var(--color-loss-wash))] p-[18px] shadow-[inset_0_0_0_1px_var(--color-loss-line)]">
            <b className="text-[15px] font-semibold">Remove Nimbus?</b>
            <p className="text-[13.5px] text-g-700">
              It stops right away and can never trade again. Your stocks and cash stay in your account; nothing is sold.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm">Keep agent</Button>
              <Button variant="danger" size="sm">
                <Icon name="face-id" size={14} />Remove agent
              </Button>
            </div>
          </section>
        </Demo>
      </States>
    </Section>
  )
}

export function SendingSection() {
  const [busy, setBusy] = useState(false)
  const run = () => {
    setBusy(true)
    void wait(1600).then(() => setBusy(false))
  }

  return (
    <Section
      title="While it sends"
      purpose="The action's own button carries the wait: the Face ID prompt, then a spinner while bluechip sends it. Nothing else moves, and there's no step list."
    >
      <States>
        <Demo label="Face ID, then sent">
          <PasskeyButton doneLabel="Sent" onAuthenticate={faceId}>Approve with Face ID</PasskeyButton>
        </Demo>
        <Demo label="Face ID cancelled">
          <PasskeyButton doneLabel="Sent" onAuthenticate={cancelled}>Approve with Face ID</PasskeyButton>
        </Demo>
        <Demo label="No Face ID needed">
          <Button loading={busy} onClick={run}>
            <Icon name="pause" size={16} />Pause Nimbus
          </Button>
        </Demo>
      </States>
    </Section>
  )
}
