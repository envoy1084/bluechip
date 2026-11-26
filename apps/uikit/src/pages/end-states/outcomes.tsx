import { DepositArrivedCard } from "@bluechip/ui/bluechip/deposit-arrived-card"
import { OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { Outcome, OutcomeLink, OutcomeMark, type OutcomeTone } from "@bluechip/ui/bluechip/outcome"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { ButterflyAssemble } from "@bluechip/ui/motion/butterfly-assemble"
import { type ReactNode, useState } from "react"
import { Demo, Section, States } from "../agents/layout.tsx"
import { faceId } from "../cards/data.ts"

const TX = "https://basescan.org/tx/0x5f1c2a7e4b9d03f6a1e8c2b7d4f9a0e3c6b1d8f2a5e7c9b3d0f4a6e8c1b2d3e4"

function Card({ children }: { readonly children: ReactNode }) {
  return <div className="w-full rounded-lg bg-white px-5 py-6 shadow-e2">{children}</div>
}

export function MarkSection() {
  const [round, setRound] = useState(0)
  const tones: ReadonlyArray<OutcomeTone> = ["pending", "success", "failure", "neutral"]

  return (
    <Section
      title="Outcome mark"
      purpose="The mark at the top of every end state: a spinner while Base takes it, then a check that draws itself, a cross, or a dash for something you left as it was. Under reduced motion it's already drawn."
    >
      <Demo className="justify-center gap-8">
        {tones.map((tone) => (
          <div key={`${tone}-${round}`} className="grid justify-items-center gap-2">
            <OutcomeMark tone={tone} size={56} />
            <span className="text-label-sm text-g-500">{tone}</span>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setRound((r) => r + 1)}>
          <Icon name="refresh" size={14} />Draw again
        </Button>
      </Demo>
    </Section>
  )
}

export function TradeOutcomesSection() {
  return (
    <Section
      title="Trades"
      purpose="A sent trade, yours or an agent's: one short wait in place, then the fill with its numbers and the next step, or what happened to the money and Try again."
    >
      <States>
        <Demo label="Buying">
          <Card>
            <Outcome
              tone="pending"
              title="Buying $50.00 of Apple"
              description="Base confirms it in a couple of seconds."
            />
          </Card>
        </Demo>
        <Demo label="Bought">
          <Card>
            <Outcome
              tone="success"
              title="Bought $50.00 of Apple"
              description="It's in your portfolio."
              actions={<Button variant="secondary" className="w-full">Buy more Apple</Button>}
            >
              <OrderPreview>
                <OrderPreviewRow label="Shares bought">0.2623 shares</OrderPreviewRow>
                <OrderPreviewRow label="Price">$190.62 a share</OrderPreviewRow>
                <OrderPreviewRow label="You paid">$50.00</OrderPreviewRow>
              </OrderPreview>
              <OutcomeLink href={TX}>View on BaseScan</OutcomeLink>
            </Outcome>
          </Card>
        </Demo>
        <Demo label="Sold">
          <Card>
            <Outcome
              tone="success"
              title="Sold 0.25 shares of Nvidia"
              description="The cash is in your account."
              actions={<Button variant="secondary" className="w-full">Trade again</Button>}
            />
          </Card>
        </Demo>
        <Demo label="Didn't go through">
          <Card>
            <Outcome
              tone="failure"
              title="Your buy didn't go through"
              description="Base didn't take it. Nothing was bought. Your cash is where it was."
              actions={<Button className="w-full">Try again</Button>}
            />
          </Card>
        </Demo>
        <Demo label="Approved for an agent">
          <Card>
            <Outcome
              tone="success"
              title="Bought $150.00 of Nvidia"
              description="It's in your portfolio."
              actions={<Button variant="secondary" className="w-full">Done</Button>}
            />
          </Card>
        </Demo>
        <Demo label="Declined">
          <Card>
            <Outcome
              tone="neutral"
              title="Declined"
              description="Nothing was bought. Nimbus won't ask about this trade again."
            />
          </Card>
        </Demo>
      </States>
    </Section>
  )
}

export function CashOutcomesSection() {
  return (
    <Section
      title="Cash"
      purpose="Money in and out. A deposit lands with the amount rolling up; a withdrawal waits a moment, then says where the USDC went."
    >
      <Demo className="justify-center">
        <DepositArrivedCard
          amount={200}
          from="0x12ab34cd56ef7890a1b2c3d4e5f6a7b8c9d09f3e"
        />
      </Demo>
      <States>
        <Demo label="Sending a withdrawal">
          <Card>
            <Outcome
              tone="pending"
              title="Sending $150.00 to 0x12ab…9f3e"
              description="Base confirms it in a couple of seconds."
              actions={<Button variant="ghost" className="w-full">Close, it keeps going</Button>}
            />
          </Card>
        </Demo>
        <Demo label="Sent">
          <Card>
            <Outcome
              tone="success"
              title="$150.00 sent to 0x12ab…9f3e"
              description="The USDC is at the address on Base."
              actions={<Button variant="secondary" className="w-full">Done</Button>}
            >
              <OutcomeLink href={TX}>View on BaseScan</OutcomeLink>
            </Outcome>
          </Card>
        </Demo>
        <Demo label="Didn't go through">
          <Card>
            <Outcome
              tone="failure"
              title="Your withdrawal didn't go through"
              description="Base didn't take it. Your cash is still in your account."
              actions={<Button variant="secondary" className="w-full">Done</Button>}
            />
          </Card>
        </Demo>
      </States>
    </Section>
  )
}

export function AgentOutcomesSection() {
  return (
    <Section
      title="Agents"
      purpose="A new agent gets a screen of its own. Changes to one are said once on its page as they land, and a removal on the list, so the page never shows a tracker."
    >
      <Demo className="justify-center">
        <div className="mx-auto grid w-full max-w-[480px] rounded-lg bg-white px-6 pt-6 pb-7 shadow-e2">
          <Outcome
            tone="success"
            size="page"
            media={<ButterflyAssemble agentId="nimbus" label="Nimbus's butterfly" className="h-[132px] w-[180px]" />}
            title="Nimbus is live"
            description="Locked with Face ID until 24 Feb. Pause it any time."
            actions={
              <>
                <Button>
                  <Icon name="plus" size={16} />Add cash
                </Button>
                <Button variant="secondary">
                  Go to Nimbus<Icon name="arrow-right" size={16} />
                </Button>
                <Button variant="ghost">See all agents</Button>
              </>
            }
          >
            <ul aria-label="It can" className="grid gap-1.5 rounded-[12px] px-3.5 py-3 surface-well">
              {[
                "Buy and sell Nvidia and Apple",
                "Spend up to $250 a day",
                "Trade up to $100 at a time, and ask you before anything bigger"
              ].map((line) => (
                <li key={line} className="grid grid-cols-[18px_minmax(0,1fr)] gap-1.5 text-[13.5px] text-g-800">
                  <Icon name="check" size={14} className="mt-[3px] text-gain" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-center text-label-sm text-g-500">It needs cash in your account to trade.</p>
          </Outcome>
        </div>
      </Demo>
      <States>
        <Demo label="Locking">
          <Card>
            <Outcome
              tone="pending"
              size="page"
              title="Locking Nimbus's rules"
              description="Base takes a couple of seconds. Once locked, every trade it makes is checked against them."
            />
          </Card>
        </Demo>
        <Demo label="Lock didn't land">
          <Card>
            <Outcome
              tone="failure"
              size="page"
              title="Nimbus's rules weren't locked"
              description="Base didn't take the lock, so nothing changed. Nimbus is saved as a draft until you lock it."
              actions={
                <PasskeyButton size="lg" doneLabel="Sent" onAuthenticate={faceId} className="w-full max-w-[340px]">
                  Lock again with Face ID
                </PasskeyButton>
              }
            />
          </Card>
        </Demo>
        {[
          ["New rules locked", "Nimbus's new rules are locked", "They apply to its next trade."],
          ["Renewed", "Nimbus is renewed", "Same rules, locked until 24 Feb."],
          ["Resumed", "Nimbus is trading again", "It trades inside its rules."],
          ["Removed, on the list", "Nimbus is removed", "It can never trade again. Your stocks and cash stay yours."]
        ].map(([label, title, description]) => (
          <Demo key={label} label={label}>
            <Alert variant="success" className="w-full">
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{description}</AlertDescription>
              <AlertAction>
                <Button variant="ghost" size="sm">Done</Button>
              </AlertAction>
            </Alert>
          </Demo>
        ))}
        <Demo label="Paused">
          <Alert variant="warning" icon="pause" className="w-full">
            <AlertTitle>Nimbus is paused</AlertTitle>
            <AlertDescription>It won't trade until you resume it. Nothing was sold.</AlertDescription>
            <AlertAction>
              <Button size="sm">
                <Icon name="play" size={14} />Resume
              </Button>
            </AlertAction>
          </Alert>
        </Demo>
      </States>
    </Section>
  )
}
