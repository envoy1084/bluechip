import { AgentDraftCard } from "@bluechip/ui/bluechip/agent-draft-card"
import { ChatComposer } from "@bluechip/ui/bluechip/chat-composer"
import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { CitationChip } from "@bluechip/ui/bluechip/citation-chip"
import { ToolCallRow, type ToolCallState } from "@bluechip/ui/bluechip/tool-call-row"
import { Button } from "@bluechip/ui/components/button"
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { useEffect, useRef, useState } from "react"
import { ACCOUNT, FILING, NEWS, PRICE, SOURCES, SUGGESTIONS } from "./data.ts"
import { Demo, Section, States } from "./layout.tsx"

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

export function ChatDemoSection() {
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
                        <AgentDraftCard
                          agentId="ai-chips"
                          name="AI chips keeper"
                          detail="Runs for 90 days once locked. Pause it any time."
                          can={[
                            "Trade Nvidia and AMD, only to move you back to your target mix",
                            "Spend up to $200 a day"
                          ]}
                          never={["Send money out of your account"]}
                          state="Not running yet"
                          footer={<Button size="sm" onClick={() => toast("Opening review")}>Review and lock</Button>}
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

export function ComposerSection() {
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

export function MessageSection() {
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

export function ToolCallSection() {
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
          <ToolCallRow state="failed" label="Couldn't check Tesla's price, the market is closed" />
        </Demo>
      </States>
    </Section>
  )
}

export function CitationSection() {
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
