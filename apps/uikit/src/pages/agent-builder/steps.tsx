import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { FlowSteps } from "@bluechip/ui/bluechip/flow-steps"
import { OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { PermissionCard } from "@bluechip/ui/bluechip/permission-card"
import { TemplatePicker } from "@bluechip/ui/bluechip/template-picker"
import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { LIMIT_PRESETS } from "@bluechip/ui/lib/agent-limits"
import { useId, useState } from "react"
import { Demo, Section, States } from "../agents/layout.tsx"
import { cancelled, faceId } from "../cards/data.ts"

const STEPS = ["Start", "Rules", "Review"] as const

export function FlowStepsSection() {
  const [at, setAt] = useState(1)

  return (
    <Section
      title="Flow steps"
      purpose="Where you are in making an agent: three steps on a thin bar, the current one named. Locking and its result end the flow, without a step of their own."
    >
      <Demo className="grid justify-items-start gap-4">
        <FlowSteps steps={STEPS} current={at} className="w-full max-w-[360px]" />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={at === 0} onClick={() => setAt((step) => step - 1)}>
            <Icon name="arrow-left" size={14} />Back
          </Button>
          <Button size="sm" disabled={at === STEPS.length - 1} onClick={() => setAt((step) => step + 1)}>
            Continue<Icon name="arrow-right" size={14} />
          </Button>
        </div>
      </Demo>
    </Section>
  )
}

export function StartSection() {
  return (
    <Section
      title="Start"
      purpose="One decision: what the agent should do. The four templates, your saved ones, or from scratch; its rules come next."
    >
      <Demo className="grid gap-3">
        <TemplatePicker defaultValue="rebalancer" />
      </Demo>
      <States>
        <Demo label="Saved templates loading">
          <SkeletonBlock aria-busy className="h-[86px] w-full rounded-lg" />
        </Demo>
        <Demo label="Saved templates didn't load">
          <p className="text-label-sm text-g-500">We couldn't load your saved templates just now.</p>
        </Demo>
      </States>
    </Section>
  )
}

export function ReviewSection() {
  const nameId = useId()
  const [name, setName] = useState("Nimbus")
  const problem = name.trim() === "" ? "Give it a name." : undefined

  return (
    <Section
      title="Review and lock"
      purpose="Its name beside what it can and never do, the worst it could do on its worst day, how long it runs, then one Face ID button whose own wait covers sending."
    >
      <Demo className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg bg-white px-[18px] py-4 shadow-e2">
            <AgentAvatar agentId={name || "nimbus"} size="lg" />
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor={nameId} className="text-label-sm font-semibold text-g-500">Name</label>
              <Input
                id={nameId}
                value={name}
                aria-invalid={problem === undefined ? undefined : true}
                onChange={(event) => setName(event.currentTarget.value)}
                className="text-[16px] font-semibold"
              />
              <p className={problem === undefined ? "text-label-sm text-g-500" : "text-label-sm font-medium text-loss"}>
                {problem ?? "Stock picker, runs for 90 days once locked."}
              </p>
            </div>
          </div>
          <PermissionCard limits={{ stocks: ["NVDA", "AAPL"], mode: "buy-and-sell", ...LIMIT_PRESETS[1]!.limits }} />
        </div>
        <div className="grid min-w-0 gap-3">
          <WorstCaseCard>
            On its worst day, this agent could make <b>12 trades</b> of up to <b>$100</b> each, spending at most{" "}
            <b>$250</b> on buys, only in Nvidia and Apple. It can never move money out of your account.
          </WorstCaseCard>
          <OrderPreview>
            <OrderPreviewRow label="Runs for">90 days, until 24 Feb</OrderPreviewRow>
            <OrderPreviewRow label="Asks you">Before trades over $100</OrderPreviewRow>
            <OrderPreviewRow label="You can">Pause it any time, instantly</OrderPreviewRow>
          </OrderPreview>
          <PasskeyButton size="lg" disabled={problem !== undefined} doneLabel="Sent" onAuthenticate={faceId}>
            Lock these rules with Face ID
          </PasskeyButton>
          <Button variant="ghost">
            <Icon name="arrow-left" size={16} />Back to rules
          </Button>
        </div>
      </Demo>
      <States>
        <Demo label="Face ID cancelled">
          <PasskeyButton size="lg" doneLabel="Sent" onAuthenticate={cancelled} className="w-full">
            Lock these rules with Face ID
          </PasskeyButton>
        </Demo>
      </States>
    </Section>
  )
}
