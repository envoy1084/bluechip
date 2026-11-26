import { AgentControlCard } from "@bluechip/ui/bluechip/agent-control-card"
import type { ChatCardStatus } from "@bluechip/ui/bluechip/chat-card"
import { ChatNotice } from "@bluechip/ui/bluechip/chat-notice"
import { CitationChip } from "@bluechip/ui/bluechip/citation-chip"
import { MemoryCard } from "@bluechip/ui/bluechip/memory-card"
import { ResearchCard } from "@bluechip/ui/bluechip/research-card"
import { SaveTemplateCard } from "@bluechip/ui/bluechip/save-template-card"
import { ToolCallRow } from "@bluechip/ui/bluechip/tool-call-row"
import { Button } from "@bluechip/ui/components/button"
import { useState } from "react"
import { ACCOUNT, FILING, NEWS, PRICE } from "../agents/data.ts"
import { Demo, Section, States } from "../agents/layout.tsx"
import { CITATIONS, ERRORS, PICKER_RULES, wait } from "./data.ts"

const noop = () => {}

/** A card you confirm, answered for real in the kit: a moment's wait, then applied or dismissed. */
const useAnswer = () => {
  const [status, setStatus] = useState<ChatCardStatus>("pending")
  const [busy, setBusy] = useState<"confirm" | "dismiss" | null>(null)
  const answer = (choice: "confirm" | "dismiss") => {
    setBusy(choice)
    void wait(700).then(() => {
      setBusy(null)
      setStatus(choice === "confirm" ? "applied" : "dismissed")
    })
  }
  return {
    status,
    busy,
    onConfirm: () => answer("confirm"),
    onDismiss: () => answer("dismiss"),
    reset: () => setStatus("pending")
  }
}

export function AgentControlSection() {
  const { reset, ...answer } = useAnswer()

  return (
    <Section
      title="Pause and resume"
      purpose="Pausing or resuming an agent, or every agent, asked in chat. Instant and bluechip's alone, so no Face ID: confirm, and the card says it's done."
    >
      <Demo className="justify-center">
        <div className="grid w-full max-w-[560px] gap-2">
          <AgentControlCard action="pause" agentName="Nimbus" {...answer} />
          {answer.status === "pending" ? null : <Button variant="ghost" size="sm" onClick={reset}>Ask again</Button>}
        </div>
      </Demo>
      <States>
        <Demo label="Working">
          <AgentControlCard
            action="resume"
            agentName="Nimbus"
            status="pending"
            busy="confirm"
            onConfirm={noop}
            onDismiss={noop}
          />
        </Demo>
        <Demo label="Every agent, done">
          <AgentControlCard
            action="pauseAll"
            agentName={null}
            status="applied"
            busy={null}
            onConfirm={noop}
            onDismiss={noop}
          />
        </Demo>
        <Demo label="Not now">
          <AgentControlCard
            action="pause"
            agentName="Nimbus"
            status="dismissed"
            busy={null}
            onConfirm={noop}
            onDismiss={noop}
          />
        </Demo>
        <Demo label="Didn't go">
          <AgentControlCard
            action="pause"
            agentName="Nimbus"
            status="pending"
            busy={null}
            problem="We couldn't reach bluechip just now. Nothing changed, so try again."
            onConfirm={noop}
            onDismiss={noop}
          />
        </Demo>
      </States>
    </Section>
  )
}

export function SaveTemplateSection() {
  const { reset: _reset, ...answer } = useAnswer()
  const next = <Button variant="secondary">Start an agent</Button>

  return (
    <Section
      title="Save template"
      purpose="A set of rules to keep as a template, saved when you confirm, then ready to start the next agent from."
    >
      <Demo className="justify-center">
        <SaveTemplateCard name="Steady picks" basedOn="Stock picker" {...PICKER_RULES} {...answer} next={next} />
      </Demo>
      <States>
        <Demo label="Saved">
          <SaveTemplateCard
            name="Steady picks"
            basedOn="Stock picker"
            {...PICKER_RULES}
            status="applied"
            busy={null}
            onConfirm={noop}
            onDismiss={noop}
            next={next}
          />
        </Demo>
        <Demo label="Not now">
          <SaveTemplateCard
            name="Steady picks"
            basedOn={null}
            {...PICKER_RULES}
            status="dismissed"
            busy={null}
            onConfirm={noop}
            onDismiss={noop}
          />
        </Demo>
      </States>
    </Section>
  )
}

export function MemorySection() {
  const { reset: _reset, ...answer } = useAnswer()
  const link = <Button variant="ghost">See what bluechip remembers</Button>
  const base = {
    kind: "Rule",
    text: "You never want Tesla.",
    busy: null,
    onConfirm: noop,
    onDismiss: noop,
    link
  } as const

  return (
    <Section
      title="Memory"
      purpose="What bluechip remembers about you: saved or forgotten when you say so, or one it noticed and keeps only if you confirm."
    >
      <Demo className="justify-center">
        <MemoryCard
          kind="Preference"
          text="You like to keep 10% in cash."
          note="From what you said on 21 Nov."
          action="confirm"
          {...answer}
          link={link}
        />
      </Demo>
      <States>
        <Demo label="Saved">
          <MemoryCard {...base} action="saved" status="applied" />
        </Demo>
        <Demo label="Forgotten">
          <MemoryCard {...base} action="forgotten" status="applied" />
        </Demo>
        <Demo label="Not kept">
          <MemoryCard {...base} action="confirm" status="dismissed" />
        </Demo>
      </States>
    </Section>
  )
}

export function ResearchSection() {
  return (
    <Section
      title="From the web"
      purpose="The pages the assistant read for an answer, each once, with the words it leans on. bluechip doesn't check them, and says so."
    >
      <Demo className="justify-center">
        <ResearchCard query="Nvidia quarterly results" citations={CITATIONS} />
      </Demo>
      <States>
        <Demo label="One page">
          <ResearchCard query="Apple buyback" citations={CITATIONS.slice(0, 1)} />
        </Demo>
        <Demo label="Nothing to cite">
          <ResearchCard query="Tesla robotaxi date" citations={[]} />
        </Demo>
      </States>
    </Section>
  )
}

export function NoticeSection() {
  return (
    <Section
      title="When an answer stops"
      purpose="Why the assistant stopped early: quiet when you stopped it or the connection dropped, a warning when bluechip did, always with what to do."
    >
      <Demo>
        <div className="grid gap-2.5">
          {ERRORS.map((error) => (
            <div key={error.reason} className="grid gap-1">
              <span className="text-[11.5px] font-[550] text-g-500">{error.reason}</span>
              <ChatNotice icon={error.icon} quiet={error.quiet}>{error.message}</ChatNotice>
            </div>
          ))}
        </div>
      </Demo>
    </Section>
  )
}

export function ToolRowSection() {
  return (
    <Section
      title="Tool rows and sources"
      purpose="What bluechip checked for an answer: a soft pill while it runs, then a quiet line with its result. Sources sit beside the claims they support."
    >
      <States>
        <Demo label="Running">
          <ToolCallRow state="running" label="Checking Nvidia's price…" />
        </Demo>
        <Demo label="Done">
          <ToolCallRow state="done" label="Checked Nvidia's price" result="$181.42" />
        </Demo>
        <Demo label="Failed">
          <ToolCallRow state="failed" label="Couldn't check Tesla's price, market closed" />
        </Demo>
        <Demo label="Sources">
          <p className="text-body-sm text-g-700">
            Nvidia is at $181.42 <CitationChip index={1} source={PRICE} />, and data center revenue rose{" "}
            <CitationChip index={2} source={FILING} /> as memory prices climb{" "}
            <CitationChip index={3} source={NEWS} />. You hold 4.1 shares <CitationChip index={4} source={ACCOUNT} />.
          </p>
        </Demo>
      </States>
    </Section>
  )
}
