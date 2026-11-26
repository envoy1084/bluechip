import { AgentDraftCard } from "@bluechip/ui/bluechip/agent-draft-card"
import { AgentGlance } from "@bluechip/ui/bluechip/agent-glance"
import { ChatCard } from "@bluechip/ui/bluechip/chat-card"
import { FairPriceCheck, OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { PolicyChangeCard } from "@bluechip/ui/bluechip/policy-change-card"
import { TradeApprovalCard } from "@bluechip/ui/bluechip/trade-approval-card"
import { TradeFill } from "@bluechip/ui/bluechip/trade-receipt"
import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { Demo, Section, States } from "../agents/layout.tsx"
import { cancelled, CHANGES, faceId, PICKER_RULES, wait } from "./data.ts"

const OPEN = (
  <Button variant="secondary">
    Open Nimbus<Icon name="arrow-right" size={16} />
  </Button>
)

const PICKER_GLANCE = (
  <AgentGlance
    stocks={["NVDA", "AAPL"]}
    direction="Buys and sells"
    stats={[{ label: "A day", value: "$250" }, { label: "Per trade", value: "$100" }, {
      label: "Trades a day",
      value: "5"
    }]}
  />
)

const APPLE_ORDER = (
  <OrderPreview>
    <OrderPreviewRow label="You pay">$50.00</OrderPreviewRow>
    <OrderPreviewRow label="Price">$190.62 a share</OrderPreviewRow>
    <OrderPreviewRow label="You get about">0.2623 shares</OrderPreviewRow>
    <OrderPreviewRow label="Fair price check">
      <FairPriceCheck>Within 1%</FairPriceCheck>
    </OrderPreviewRow>
  </OrderPreview>
)

export function TradeApprovalSection() {
  const [signed, setSigned] = useState<"no" | "sending" | "filled">("no")
  const approve = async () => {
    await faceId()
    setSigned("sending")
    void wait(2000).then(() => setSigned("filled"))
  }

  return (
    <Section
      title="Your trade"
      purpose="Your own trade from chat, prepared for Face ID, with exactly what it does at the quoted price. After you approve, the same card turns into the trade's end: a short wait, then what it bought, with its receipt."
    >
      <Demo className="justify-center">
        {signed === "no" ?
          (
            <TradeApprovalCard
              title="Buy $50.00 of Apple"
              detail="At the pool's price now, checked against Chainlink's"
              preview={APPLE_ORDER}
              reason="You asked for $50 of Apple."
              action={<PasskeyButton doneLabel="Sent" onAuthenticate={approve}>Buy with Face ID</PasskeyButton>}
            />
          ) :
          (
            <ChatCard tag="Your trade" icon="face-id" tone="quiet">
              <Outcome
                tone={signed === "filled" ? "success" : "pending"}
                title={signed === "filled" ? "Bought $50.00 of Apple" : "Buying $50.00 of Apple"}
                description={signed === "filled"
                  ? "It's in your portfolio."
                  : "Base confirms it in a couple of seconds."}
                actions={signed === "filled" ?
                  <Button variant="secondary" onClick={() => setSigned("no")}>Trade again</Button> :
                  undefined}
              />
              {signed === "filled" ?
                <TradeFill side="buy" total={50} shares={0.2623} price={190.62} txHash={`0x${"5e".repeat(32)}`} /> :
                null}
            </ChatCard>
          )}
      </Demo>
      <States>
        <Demo label="Prices paused, first transaction">
          <TradeApprovalCard
            title="Sell 1 share of Nvidia"
            detail="About $181.42 at $181.42 each"
            warnings={["The market is closed, so prices are paused. It trades at the pool's price."]}
            setsUpAccount
            action={<PasskeyButton doneLabel="Sent" onAuthenticate={faceId}>Sell with Face ID</PasskeyButton>}
          />
        </Demo>
        <Demo label="Face ID cancelled">
          <TradeApprovalCard
            title="Buy $50.00 of Apple"
            detail="About 0.2623 shares at $190.62 each"
            problem="Face ID was cancelled or the trade couldn't be sent. Nothing was bought."
            action={<PasskeyButton doneLabel="Sent" onAuthenticate={cancelled}>Buy with Face ID</PasskeyButton>}
          />
        </Demo>
        <Demo label="Didn't go through">
          <ChatCard tag="Your trade" icon="face-id" tone="quiet">
            <Outcome
              tone="failure"
              title="Your buy didn't go through"
              description="Base didn't take it. Nothing was bought. Your cash is where it was."
              actions={<Button variant="secondary">Done</Button>}
            />
          </ChatCard>
        </Demo>
      </States>
    </Section>
  )
}

export function AgentTradeSection() {
  return (
    <Section
      title="Agent trade"
      purpose="A trade you asked an agent for: checked against its rules, then sent by the agent, or waiting for your Face ID, blocked or waiting. Once sent it ends in one place."
    >
      <States>
        <Demo label="Checking">
          <ChatCard tag="Agent trade" icon="agent" tone="quiet">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-[15px] font-semibold">Buy $50.00 of Nvidia</b>
              <span className="rounded-full bg-blue-50 px-2 py-px text-[11.5px] font-semibold text-blue">Checking</span>
            </div>
            <p className="text-label-sm text-g-600">Checking it against the agent's policies…</p>
          </ChatCard>
        </Demo>
        <Demo label="Filled">
          <ChatCard tag="Agent trade" icon="agent" tone="quiet">
            <Outcome tone="success" title="Bought $50.00 of Nvidia" description="It's in your portfolio." />
          </ChatCard>
        </Demo>
        <Demo label="Blocked">
          <ChatCard tag="Agent trade" icon="agent" tone="quiet">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-[15px] font-semibold">Buy $400.00 of Tesla</b>
              <span className="rounded-full bg-loss-wash px-2 py-px text-[11.5px] font-semibold text-loss">
                Blocked
              </span>
            </div>
            <p className="text-label-sm text-loss">Blocked by Stocks and direction: it doesn't trade Tesla.</p>
            <p className="text-label-sm text-g-600">Nothing was bought. Your cash is where it was.</p>
          </ChatCard>
        </Demo>
      </States>
    </Section>
  )
}

export function DraftAgentSection() {
  const [state, setState] = useState<"draft" | "locking" | "live">("draft")
  const lock = async () => {
    await faceId()
    setState("locking")
    void wait(2000).then(() => setState("live"))
  }
  const footer = state === "draft" ?
    (
      <>
        <Button variant="ghost">Customize</Button>
        <PasskeyButton doneLabel="Sent" onAuthenticate={lock}>Lock with Face ID</PasskeyButton>
      </>
    ) :
    OPEN

  return (
    <Section
      title="Draft agent"
      purpose="An agent drafted from chat: its limits at a glance, what it can and never does, the most it could do on its worst day, Customize to change it, Face ID to lock it. Once locked the card says so in place."
    >
      <Demo className="justify-center">
        <AgentDraftCard
          agentId="nimbus"
          name="Nimbus"
          detail="Runs for 90 days once locked. Pause it any time."
          {...PICKER_RULES}
          glance={PICKER_GLANCE}
          worstCase={
            <WorstCaseCard tone="quiet">
              On its worst day it could spend $250 in up to 5 trades of $100, $1,750 in a week. Each trade stays close
              to Chainlink's price, so prices could cost it at most $5 a day, $35 a week. It can never send money out of
              your account.
            </WorstCaseCard>
          }
          state={state === "draft" ? "Not running yet" : state === "locking" ? "Locking on Base" : "Running"}
          tone={state === "live" ? "done" : state === "locking" ? "quiet" : "waiting"}
          footer={footer}
        >
          {state === "draft" ?
            undefined :
            (
              <Outcome
                tone={state === "live" ? "success" : "pending"}
                title={state === "live" ? "Nimbus is live" : "Locking Nimbus's rules"}
                description={state === "live" ? "It trades inside its rules." : "Base takes a couple of seconds."}
              />
            )}
        </AgentDraftCard>
      </Demo>
      <States>
        <Demo label="Face ID cancelled">
          <AgentDraftCard
            agentId="nimbus"
            name="Nimbus"
            detail="Runs for 90 days once locked. Pause it any time."
            {...PICKER_RULES}
            state="Not running yet"
            problem="Face ID was cancelled or the request couldn't be sent. Nothing changed."
            footer={<PasskeyButton doneLabel="Sent" onAuthenticate={cancelled}>Lock with Face ID</PasskeyButton>}
          />
        </Demo>
      </States>
    </Section>
  )
}

export function PolicyChangeSection() {
  return (
    <Section
      title="Rule change, renewal and removal"
      purpose="A change of an agent's rules, its renewal or its removal, signed with Face ID in the conversation. Each rule says how it changes; a looser change says so."
    >
      <Demo className="justify-center">
        <PolicyChangeCard
          action="update"
          agentId="nimbus"
          name="Nimbus"
          note="Its new rules are locked onchain once you approve."
          changes={CHANGES}
          looser
          glance={PICKER_GLANCE}
          {...PICKER_RULES}
          state="Needs Face ID"
          footer={<PasskeyButton doneLabel="Sent" onAuthenticate={faceId}>Approve with Face ID</PasskeyButton>}
        />
      </Demo>
      <States>
        <Demo label="Renewal">
          <PolicyChangeCard
            action="renew"
            agentId="nimbus"
            name="Nimbus"
            note="Locks the same rules with a new key for 90 more days."
            state="Needs Face ID"
            footer={<PasskeyButton doneLabel="Sent" onAuthenticate={faceId}>Renew with Face ID</PasskeyButton>}
          />
        </Demo>
        <Demo label="Removal">
          <PolicyChangeCard
            action="remove"
            agentId="nimbus"
            name="Nimbus"
            note="It stops for good. Your stocks and cash stay in your account."
            state="Needs Face ID"
            footer={<PasskeyButton doneLabel="Sent" onAuthenticate={faceId}>Remove with Face ID</PasskeyButton>}
          />
        </Demo>
        <Demo label="Sent, on its way">
          <PolicyChangeCard
            action="update"
            agentId="nimbus"
            name="Nimbus"
            note=""
            state="Changing on Base"
            tone="quiet"
            footer={OPEN}
          >
            <Outcome tone="pending" title="Changing Nimbus's rules" description="Base takes a couple of seconds." />
          </PolicyChangeCard>
        </Demo>
        <Demo label="Landed">
          <PolicyChangeCard
            action="renew"
            agentId="nimbus"
            name="Nimbus"
            note=""
            state="Running"
            tone="done"
            footer={OPEN}
          >
            <Outcome tone="success" title="Nimbus is renewed" description="It trades inside its rules." />
          </PolicyChangeCard>
        </Demo>
        <Demo label="A draft, removed at once">
          <PolicyChangeCard
            action="remove"
            agentId="nimbus"
            name="Nimbus"
            note=""
            state="Done"
            tone="done"
            footer={undefined}
          >
            <Outcome
              tone="success"
              title="Nimbus is removed"
              description="It was a draft, so it was removed right away. Nothing was onchain."
            />
          </PolicyChangeCard>
        </Demo>
      </States>
    </Section>
  )
}
