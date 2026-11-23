import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { type Agent, AgentCard, AgentRow } from "@bluechip/ui/bluechip/agent-card"
import { AgentDraftCard } from "@bluechip/ui/bluechip/agent-draft-card"
import { AGENT_STATES, type AgentState, AgentStatus } from "@bluechip/ui/bluechip/agent-status"
import { ChatComposer } from "@bluechip/ui/bluechip/chat-composer"
import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { CitationChip, type CitationSource } from "@bluechip/ui/bluechip/citation-chip"
import { DailyBriefCard } from "@bluechip/ui/bluechip/daily-brief-card"
import { LimitEditor } from "@bluechip/ui/bluechip/limit-editor"
import { PermissionCard } from "@bluechip/ui/bluechip/permission-card"
import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import { ProposalCard, type ProposalCardProps } from "@bluechip/ui/bluechip/proposal-card"
import { AGENT_TEMPLATES, type AgentTemplate, TemplatePicker } from "@bluechip/ui/bluechip/template-picker"
import { ToolCallRow, type ToolCallState } from "@bluechip/ui/bluechip/tool-call-row"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Button } from "@bluechip/ui/components/button"
import { Slider } from "@bluechip/ui/components/slider"
import { toast, Toaster } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { type AgentLimits, formatDollars, LIMIT_PRESETS } from "@bluechip/ui/lib/agent-limits"
import { cn } from "@bluechip/ui/lib/cn"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"

export const Route = createFileRoute("/kit/agents")({ component: KitAgents })

/* ---------- Example data ---------- */

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: "rebalancer",
    name: "Rebalancer",
    description: "Keeps your mix on target",
    state: "active",
    spentToday: 140,
    lockedUntil: "21 Feb",
    limits: {
      stocks: ["NVDA", "AAPL", "MSFT", "TSLA"],
      mode: "rebalance",
      dailySpend: 200,
      maxPerTrade: 100,
      maxInOneStock: 30,
      cashReserve: 10,
      approveAbove: 150
    }
  },
  {
    id: "picker",
    name: "Tech picker",
    description: "Trades Nvidia, Apple and Tesla",
    state: "needs-approval",
    spentToday: 410,
    lockedUntil: "3 Mar",
    limits: {
      stocks: ["NVDA", "AAPL", "TSLA"],
      mode: "buy-and-sell",
      dailySpend: 500,
      maxPerTrade: 250,
      maxInOneStock: 30,
      cashReserve: 10,
      approveAbove: 300
    }
  },
  {
    id: "weekly",
    name: "Weekly buyer",
    description: "Buys $50 of Microsoft every Monday",
    state: "stopped",
    spentToday: 50,
    lockedUntil: "1 Mar",
    limits: {
      stocks: ["MSFT"],
      mode: "buy",
      dailySpend: 50,
      maxPerTrade: 50,
      maxInOneStock: 25,
      cashReserve: 10,
      approveAbove: 100
    }
  },
  {
    id: "guard",
    name: "Stop-loss guard",
    description: "Sells Tesla if it drops 10%",
    state: "paused",
    spentToday: 0,
    lockedUntil: "21 Feb",
    limits: {
      stocks: ["TSLA"],
      mode: "sell",
      dailySpend: 0,
      maxPerTrade: 2500,
      maxInOneStock: 100,
      cashReserve: 0,
      approveAbove: 5000
    }
  }
]
const [REBALANCER, PICKER, WEEKLY, GUARD] = AGENTS as [Agent, Agent, Agent, Agent]

const LAST_ACTION: Readonly<Record<string, string>> = {
  rebalancer: "Sold $73.61 of Nvidia, bought Apple · 9:41",
  picker: "Wants to buy $600 of Nvidia · Just now",
  weekly: "Bought $50 of Microsoft · Mon 09:30",
  guard: "Watching Tesla, 4% above your stop · 2 min ago"
}

const BALANCED = LIMIT_PRESETS[1]!.limits
const EDITOR_START: AgentLimits = { stocks: ["NVDA", "AAPL", "MSFT"], mode: "buy-and-sell", ...BALANCED }

const SOURCES: ReadonlyArray<CitationSource> = [
  {
    kind: "Price",
    icon: "chart-line",
    from: "Price feed",
    title: "NVDA / USD on Base",
    when: "Updated 12 seconds ago"
  },
  {
    kind: "Filing",
    icon: "book",
    from: "Nvidia 10-Q",
    title: "Quarterly report, data center revenue",
    when: "19 Nov 2026"
  },
  {
    kind: "News",
    icon: "news",
    from: "Reuters",
    title: "Memory makers raise prices on AI demand",
    when: "23 Nov 2026"
  },
  { kind: "Account", icon: "wallet", from: "Your portfolio", title: "Holdings and limits", when: "Right now" }
]
const [PRICE, FILING, NEWS, ACCOUNT] = SOURCES as [CitationSource, CitationSource, CitationSource, CitationSource]

const PROPOSAL: Omit<ProposalCardProps, "onApprove" | "onAdjust"> = {
  title: "AI chips and memory",
  holdings: [{ symbol: "NVDA", weight: 30, cappedFrom: 45 }, { symbol: "SNDK", weight: 30 }, {
    symbol: "MSFT",
    weight: 25
  }],
  unavailable: ["AMD", "TSM"],
  facts: [
    { text: "Nvidia gets most of its revenue from data center chips.", source: FILING },
    { text: "Memory prices rose this quarter as AI servers need more of it.", source: NEWS },
    { text: "Nvidia trades at $181.42 right now.", source: PRICE }
  ],
  assumptions: ["You'll hold for months, not days.", "You're fine with daily swings of 5% or more."],
  opinions: ["Memory makers could gain if AI spending keeps growing. It may not."]
}

const SUGGESTIONS = [
  "Create an agent that only rebalances my portfolio",
  "What's Nvidia's price?",
  "Sell Tesla if it drops 10%",
  "How did I do this week?"
]

/* ---------- Page layout ---------- */

function ExampleFlag() {
  return (
    <span className="inline-flex items-center rounded-full bg-warn-wash px-2 py-0.5 text-[11.5px] font-semibold text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]">
      Example
    </span>
  )
}

function Group({ n, title, children }: { readonly n: string; readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="pt-10">
      <div className="flex items-baseline gap-3.5 pb-2">
        <span className="text-label font-semibold text-blue">{n}</span>
        <h2 className="text-[clamp(24px,3vw,30px)] font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Section({ title, purpose, children }: {
  readonly title: string
  readonly purpose: string
  readonly children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-4 border-t border-ink/7 pt-9 pb-10">
      <header>
        <h3 id={id} className="text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="mt-1 max-w-[64ch] text-body-sm text-g-600">{purpose}</p>
      </header>
      {children}
    </section>
  )
}

function Demo({ label, className, children }: {
  readonly label?: string
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-wrap items-center gap-3.5 rounded-lg bg-white p-4 shadow-e1 sm:p-7",
        label && "pt-[42px] sm:pt-12",
        className
      )}
    >
      {label && <span className="absolute top-3.5 left-4 text-[11.5px] font-[550] text-g-500">{label}</span>}
      {children}
    </div>
  )
}

function States({ children }: { readonly children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">{children}</div>
}

/* ---------- Page ---------- */

function KitAgents() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">bluechip</span>
        <h1 className="text-display-3 font-semibold">Agents & chat</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          Agents are teammates with a butterfly and a rulebook: who they are, the limits they can never break, and the
          conversation where you ask for them. Every amount here is an example.
        </p>
      </div>
      <Group n="01" title="Agents & limits">
        <StatusSection />
        <AgentCardSection />
        <PermissionSection />
        <UsageSection />
        <PresetSection />
        <LimitEditorSection />
        <TemplateSection />
        <DraftSection />
      </Group>
      <Group n="02" title="Chat">
        <ChatDemoSection />
        <ComposerSection />
        <MessageSection />
        <ToolCallSection />
        <CitationSection />
        <ProposalSection />
        <BriefSection />
      </Group>
      <Toaster />
    </div>
  )
}

/* ---------- Agents & limits ---------- */

function StatusSection() {
  const [state, setState] = useState<AgentState>("active")
  return (
    <Section
      title="Agent status"
      purpose="One word for what an agent is doing. Each state has its own color and icon, so it reads without color too. Select one to read what it means."
    >
      <Demo className="flex-col items-stretch">
        <fieldset aria-label="Agent states" className="flex flex-wrap justify-center gap-2">
          {(Object.keys(AGENT_STATES) as Array<AgentState>).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === state}
              onClick={() => setState(key)}
              className="cursor-pointer rounded-full p-1 transition-[background,box-shadow] duration-fast hover:bg-ink/4 aria-pressed:bg-white aria-pressed:shadow-e2"
            >
              <AgentStatus state={key} />
            </button>
          ))}
        </fieldset>
        <div className="mx-auto flex w-full max-w-[440px] items-center gap-3.5 rounded-lg bg-white p-4 shadow-e2">
          <AgentAvatar
            agentId="picker"
            size="lg"
            status={AGENT_STATES[state].dot}
            removed={state === "removed"}
          />
          <div className="grid gap-0.5">
            <b className="text-body-sm font-semibold">Tech picker</b>
            <span className="text-label text-g-500">{AGENT_STATES[state].description}</span>
          </div>
        </div>
      </Demo>
    </Section>
  )
}

function AgentCardSection() {
  const [selected, setSelected] = useState(REBALANCER.id)
  const agent = AGENTS.find((candidate) => candidate.id === selected) ?? REBALANCER
  return (
    <Section
      title="Agent card"
      purpose="Compact in lists and the sidebar; full on the agent's page, with its last action and everything it can and can never do. Pick an agent on the left to open its full card."
    >
      <Demo className="grid items-start gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <fieldset aria-label="Your agents" className="grid gap-0.5 rounded-lg bg-white p-1.5 shadow-e2">
          {AGENTS.map((candidate) => (
            <AgentRow
              key={candidate.id}
              agent={candidate}
              selected={candidate.id === selected}
              onClick={() => setSelected(candidate.id)}
            />
          ))}
        </fieldset>
        <AgentCard
          agent={agent}
          lastAction={LAST_ACTION[agent.id] ?? ""}
          onEditLimits={() => toast("Opening the limit editor")}
        />
      </Demo>
    </Section>
  )
}

function PermissionSection() {
  return (
    <Section
      title="Permission card"
      purpose="The promise, in two columns: everything an agent may do, everything it never can, how much it has used today, and when the Face ID lock runs out."
    >
      <Demo className="justify-center">
        <PermissionCard
          className="max-w-[560px]"
          limits={REBALANCER.limits}
          spentToday={140}
          lockedUntil="21 Feb"
          onEditLimits={() => toast("Opening the limit editor")}
        />
      </Demo>
      <States>
        <Demo label="Compact · buy only" className="items-start">
          <PermissionCard size="compact" limits={WEEKLY.limits} spentToday={50} lockedUntil="1 Mar" />
        </Demo>
        <Demo label="Draft · not locked" className="items-start">
          <PermissionCard size="compact" limits={GUARD.limits} />
        </Demo>
      </States>
    </Section>
  )
}

function UsageSection() {
  const [spent, setSpent] = useState(140)
  return (
    <Section
      title="Usage meter"
      purpose="How much of today's spending limit an agent has used. It turns amber at 80% and red when it's used up, and always says when it resets."
    >
      <Demo className="justify-center">
        <div className="grid w-full max-w-[420px] gap-5">
          <UsageMeter used={spent} limit={200} />
          <div className="grid gap-1">
            <span className="text-label-sm font-medium text-g-500">Simulate spending</span>
            <Slider
              min={0}
              max={200}
              step={5}
              value={spent}
              onValueChange={(next) => setSpent(typeof next === "number" ? next : next[0] ?? 0)}
              thumbLabels={["Amount spent today"]}
              format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
              showValues={false}
              showScale={false}
            />
          </div>
        </div>
      </Demo>
      <States>
        <Demo label="Normal">
          <UsageMeter used={60} limit={200} />
        </Demo>
        <Demo label="Near the limit">
          <UsageMeter used={170} limit={200} />
        </Demo>
        <Demo label="At the limit">
          <UsageMeter used={200} limit={200} />
        </Demo>
      </States>
    </Section>
  )
}

function PresetSection() {
  const [picked, setPicked] = useState("Balanced: $250 a day, $100 per trade, 30% max in one stock.")
  return (
    <Section
      title="Preset picker"
      purpose="Three starting points for limits, so nobody faces five sliders first. Arrow keys move between them; picking one fills the limit editor."
    >
      <Demo className="flex-col items-stretch">
        <PresetPicker
          defaultValue="balanced"
          onValueChange={(preset) =>
            setPicked(
              `${preset.label}: ${formatDollars(preset.limits.dailySpend)} a day, ${
                formatDollars(preset.limits.maxPerTrade)
              } per trade, ${preset.limits.maxInOneStock}% max in one stock.`
            )}
        />
        <span aria-live="polite" className="text-label text-g-500">{picked}</span>
      </Demo>
    </Section>
  )
}

const faceId = () => new Promise<void>((resolve) => setTimeout(resolve, 1200))

function LimitEditorSection() {
  const [locked, setLocked] = useState(EDITOR_START)
  const [draft, setDraft] = useState(EDITOR_START)
  return (
    <Section
      title="Limit editor"
      purpose="Set what an agent may do and read it back as plain sentences while you drag. Each change is marked: tighter limits apply at once; looser ones need Face ID, because they give the agent more power."
    >
      <Demo className="items-start">
        <LimitEditor
          locked={locked}
          value={draft}
          onValueChange={setDraft}
          lockedUntil="22 Feb"
          onApply={(limits) => {
            setLocked(limits)
            toast.success("Tighter limits are live")
          }}
          onLock={async (limits) => {
            await faceId()
            setLocked(limits)
            toast.success("Locked with Face ID", { description: "New limits are live until 22 Feb." })
          }}
        />
      </Demo>
    </Section>
  )
}

function TemplateSection() {
  const [template, setTemplate] = useState<AgentTemplate>(AGENT_TEMPLATES[0]!)
  return (
    <Section
      title="Template picker"
      purpose="The four kinds of agent bluechip makes, each with its picture and the one rule that defines it. Picking one starts the agent draft."
    >
      <Demo className="flex-col items-stretch">
        <TemplatePicker value={template.name} onValueChange={setTemplate} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span aria-live="polite" className="text-label text-g-500">{template.label} selected.</span>
          <Button size="sm" onClick={() => toast(`Drafting a ${template.label}`)}>
            Use template<Icon name="arrow-right" size={14} />
          </Button>
        </div>
      </Demo>
    </Section>
  )
}

function DraftSection() {
  return (
    <Section
      title="Agent draft card"
      purpose="What chat hands you after “create an agent that…”: the agent, its rules in sentences, and one button to review and lock it. Nothing runs until it's locked with Face ID."
    >
      <Demo className="justify-center">
        <AgentDraftCard
          className="max-w-[520px]"
          agentId="rebalancer"
          name="Rebalancer"
          template="Rebalancer"
          summary="Keeps you at 30 / 25 / 20 / 15, 10% cash"
          limits={REBALANCER.limits}
          duration="Lasts 90 days, until 22 Feb. You can pause it any time."
          onReview={() => toast("Opening review")}
          onEditRule={(rule) => toast(`Edit: ${rule}`)}
        />
      </Demo>
      <States>
        <Demo label="Inline, in a chat answer">
          <AgentDraftCard
            variant="inline"
            agentId="rebalancer"
            name="Rebalancer"
            template="Rebalancer"
            summary="$200 a day · rebalance only"
            limits={REBALANCER.limits}
            onReview={() => toast("Opening review")}
          />
        </Demo>
      </States>
    </Section>
  )
}

/* ---------- Chat ---------- */

type ThreadEntry =
  | { readonly id: number; readonly from: "you"; readonly text: string }
  | {
    readonly id: number
    readonly from: "bluechip"
    readonly text: string
    readonly streaming: boolean
    readonly tool?: { readonly state: ToolCallState; readonly label: string; readonly result?: string }
    readonly cards: boolean
  }

const REPLY = "Here's a basket for **AI chips and memory**, and an agent that keeps it on target.[^1]\n"
  + "- [[NVDA]] Nvidia is capped at **30%**, your max in one stock.\n"
  + "- AMD isn't available on bluechip, so it's left out.\n"
  + "Nothing trades until you approve it."

function ChatDemoSection() {
  const [thread, setThread] = useState<ReadonlyArray<ThreadEntry>>([
    {
      id: 0,
      from: "bluechip",
      text: "Hi Maya. Ask me about your money, or tell me what kind of agent you want.",
      streaming: false,
      cards: false
    }
  ])
  const [sending, setSending] = useState(false)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const nextId = useRef(1)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const later = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms))
  const updateReply = (id: number, patch: Partial<Extract<ThreadEntry, { from: "bluechip" }>>) =>
    setThread((entries) =>
      entries.map((entry) => entry.id === id && entry.from === "bluechip" ? { ...entry, ...patch } : entry)
    )

  const send = (message: string) => {
    const id = nextId.current + 1
    nextId.current += 2
    setSending(true)
    setThread((entries) => [
      ...entries,
      { id: id - 1, from: "you", text: message },
      { id, from: "bluechip", text: "", streaming: true, cards: false }
    ])
    later(600, () => updateReply(id, { tool: { state: "running", label: "Checking prices and your limits…" } }))
    later(1700, () => {
      updateReply(id, { tool: { state: "done", label: "Checked prices and your limits", result: "5 stocks" } })
      const words = REPLY.split(/(\s+)/)
      for (let shown = 3; shown < words.length + 3; shown += 3) {
        later(shown * 15, () => updateReply(id, { text: words.slice(0, shown).join("") }))
      }
      later((words.length + 3) * 15 + 50, () => {
        updateReply(id, { streaming: false, cards: true })
        setSending(false)
      })
    })
  }

  return (
    <Section
      title="Chat, end to end"
      purpose="Home is a conversation. Send anything: bluechip types, checks prices in a tool-call row, streams its answer, then hands you a proposal and an agent draft."
    >
      <Demo className="justify-center">
        <div className="grid w-full max-w-[640px] overflow-hidden rounded-lg bg-white shadow-e2">
          <div
            aria-live="polite"
            className="grid min-h-[180px] content-start gap-4 overflow-y-auto p-5 max-sm:px-3.5"
          >
            {thread.map((entry) =>
              entry.from === "you" ?
                <ChatMessage key={entry.id} from="you" text={entry.text} /> :
                (
                  <ChatMessage
                    key={entry.id}
                    from="bluechip"
                    text={entry.text}
                    status={entry.streaming ? "streaming" : "done"}
                    sources={[ACCOUNT]}
                    toolCalls={entry.tool && <ToolCallRow {...entry.tool} />}
                    attachments={entry.cards && (
                      <>
                        <ProposalCard
                          {...PROPOSAL}
                          onApprove={() => toast("Opening approval")}
                          onAdjust={() => toast("Adjust the weights")}
                        />
                        <AgentDraftCard
                          variant="inline"
                          agentId="ai-chips"
                          name="AI chips keeper"
                          template="Rebalancer"
                          summary="$200 a day · rebalance only"
                          limits={REBALANCER.limits}
                          onReview={() => toast("Opening review")}
                        />
                      </>
                    )}
                  />
                )
            )}
          </div>
          <ChatComposer className="px-2.5 pb-2.5" suggestions={SUGGESTIONS} sending={sending} onSend={send} />
        </div>
      </Demo>
    </Section>
  )
}

function ComposerSection() {
  return (
    <Section
      title="Chat composer"
      purpose="The box grows with your text up to six lines, Enter sends, Shift+Enter adds a line. Suggestions fill it for you. Send is blocked while it's empty or while bluechip answers. No attachments, by design."
    >
      <States>
        <Demo label="Empty, with suggestions" className="items-end">
          <ChatComposer className="w-full" suggestions={SUGGESTIONS.slice(1, 3)} onSend={(message) => toast(message)} />
        </Demo>
        <Demo label="Waiting for a reply" className="items-end">
          <ChatComposer className="w-full" sending onStop={() => toast("Stopped")} onSend={() => undefined} />
        </Demo>
      </States>
    </Section>
  )
}

function MessageSection() {
  return (
    <Section
      title="Chat message"
      purpose="You on the right in a soft bubble; bluechip on the left with the chip mark and no bubble, so long answers read like a page. Answers support bold, lists, ticker chips and sources."
    >
      <Demo className="flex-col items-stretch gap-4">
        <ChatMessage from="you" text="Should I buy more Nvidia?" />
        <ChatMessage
          from="bluechip"
          sources={SOURCES}
          text={"I can't tell you what to buy, but here's where you stand:\n"
            + "- [[NVDA]] Nvidia is **28.5%** of your money.[^4]\n"
            + "- Your max in one stock is **30%**, so there's room for about **$180** more.\n"
            + "- It's up 1.86% today.[^1]\n"
            + "Want me to set an agent to buy only up to your max?"}
        />
        <ChatMessage from="bluechip" status="streaming" />
      </Demo>
      <States>
        <Demo label="You" className="items-start">
          <ChatMessage className="w-full" from="you" text="Pause the weekly buyer" />
        </Demo>
        <Demo label="Streaming" className="items-start">
          <ChatMessage from="bluechip" status="streaming" text="Pausing Weekly buyer" />
        </Demo>
        <Demo label="Error" className="items-start">
          <ChatMessage
            from="bluechip"
            status="error"
            error="I couldn't reach prices just now. Try again in a minute."
            onRetry={() => toast("Retrying")}
          />
        </Demo>
      </States>
    </Section>
  )
}

function ToolCallSection() {
  const [state, setState] = useState<ToolCallState>("done")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const run = () => {
    setState("running")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState("done"), 1200)
  }
  return (
    <Section
      title="Tool-call row"
      purpose="When bluechip checks something, it says so in a quiet line, so you can see where an answer came from. Running spins, done checks, failed explains."
    >
      <Demo className="flex-col items-start">
        <ToolCallRow
          state={state}
          label={state === "running" ? "Checking Nvidia's price…" : "Checked Nvidia's price"}
          result="$181.42"
        />
        <Button variant="secondary" size="sm" onClick={run}>
          <Icon name="refresh" size={14} />Run again
        </Button>
      </Demo>
      <States>
        <Demo label="Running">
          <ToolCallRow state="running" label="Checking Nvidia's price…" />
        </Demo>
        <Demo label="Done">
          <ToolCallRow state="done" label="Checked Nvidia's price" result="$181.42" />
        </Demo>
        <Demo label="Failed">
          <ToolCallRow state="failed" label="Couldn't check Tesla's price · market closed" />
        </Demo>
      </States>
    </Section>
  )
}

function CitationSection() {
  return (
    <Section
      title="Citation chip"
      purpose="A numbered source next to the claim it supports. Click or press Enter for where it came from and how fresh it is. Escape closes it."
    >
      <Demo>
        <p className="max-w-[60ch] text-body leading-[1.9] text-g-800">
          Nvidia is $181.42 right now <CitationChip index={1} source={PRICE} />{" "}
          and makes most of its money from data center chips{" "}
          <CitationChip index={2} source={FILING} />. Memory prices rose this quarter{" "}
          <CitationChip index={3} source={NEWS} />, and it's 28.5% of your money{" "}
          <CitationChip index={4} source={ACCOUNT} />.
        </p>
      </Demo>
    </Section>
  )
}

function ProposalSection() {
  return (
    <Section
      title="Proposal card"
      purpose="When you ask for ideas, bluechip answers with a basket you can inspect: weights, facts with sources, the assumptions it made and its opinions, labelled as opinions. It says what it can't offer and what your limits changed."
    >
      <Demo className="justify-center">
        <ProposalCard
          {...PROPOSAL}
          className="max-w-[600px]"
          flag={<ExampleFlag />}
          onApprove={() => toast("Opening approval")}
          onAdjust={() => toast("Adjust the weights")}
        />
      </Demo>
    </Section>
  )
}

function BriefSection() {
  return (
    <Section
      title="Daily brief card"
      purpose="One card each morning from all your agents: what they did, what they're watching, and what they refused to do because of your limits. Refusals are a feature, so they get their own section."
    >
      <Demo className="justify-center">
        <DailyBriefCard
          className="max-w-[560px]"
          date="Tuesday 24 November"
          flag={<ExampleFlag />}
          did={[
            {
              agentId: "rebalancer",
              agentName: "Rebalancer",
              text: "Sold $73.61 of Nvidia, bought Apple. Back on target."
            },
            { agentId: "weekly", agentName: "Weekly buyer", text: "Bought $50 of Microsoft, as planned every Monday." }
          ]}
          watching={[
            { agentId: "guard", agentName: "Stop-loss guard", text: "Tesla is 4% above your stop at $317.48." },
            { agentId: "rebalancer", agentName: "Rebalancer", text: "Nvidia is at 28.5%, close to your 30% max." }
          ]}
          refused={[
            {
              agentId: "picker",
              agentName: PICKER.name,
              text: "Didn't buy $2,400 of Tesla. It would have put 41% in one stock."
            },
            {
              agentId: "picker",
              agentName: PICKER.name,
              text: "Didn't trade at 9:31: the price was 1.4% off the market."
            }
          ]}
        />
      </Demo>
    </Section>
  )
}
