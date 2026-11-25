import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@bluechip/ui/components/accordion"
import { Button } from "@bluechip/ui/components/button"
import { Carousel, CarouselContent, CarouselControls, CarouselItem } from "@bluechip/ui/components/carousel"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@bluechip/ui/components/resizable"
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { AGENTS, LIMITS } from "./data.ts"
import { Limits, Section } from "./layout.tsx"

function TemplateCard({ agent }: { readonly agent: (typeof AGENTS)[number] }) {
  return (
    <div className="flex h-full flex-col items-start gap-2.5 rounded-lg bg-white p-4 shadow-e1">
      <div className="mb-1 grid h-[120px] w-full place-items-center rounded-md bg-sunken bg-[radial-gradient(rgba(10,11,13,.07)_1px,transparent_1px)] bg-size-[12px_12px] text-blue">
        <Icon name={agent.icon} size={32} />
      </div>
      <h3 className="text-body font-semibold">{agent.name}</h3>
      <p className="text-label text-g-600">{agent.say}</p>
      <Button variant="secondary" size="sm" className="mt-auto" onClick={() => toast(`Starting ${agent.name}`)}>
        Use template
      </Button>
    </div>
  )
}

export function AccordionSection() {
  return (
    <Section
      id="accordion"
      title="Accordion"
      base="Accordion"
      purpose="Stacked questions that open one at a time. Good for FAQs and long settings."
    >
      <Accordion defaultValue={["cash"]}>
        {[
          [
            "cash",
            "What can an agent do with my cash?",
            "Only what its limits allow: which stocks, how much per day and per trade, and when it must ask you. Limits are locked with Face ID and checked onchain before every trade."
          ],
          [
            "withdraw",
            "Can an agent withdraw my money?",
            "No. Agents can trade inside your account. Moving cash out always needs you and Face ID."
          ],
          [
            "stopped",
            "What happens when a limit stops a trade?",
            "The trade doesn't happen. You'll see “Your limit stopped this trade” in Activity, with the limit that stopped it."
          ],
          [
            "remove",
            "How do I remove an agent?",
            "Open the agent and choose Remove agent. It stops right away; your stocks and cash stay put."
          ]
        ].map(([value, question, answer]) => (
          <AccordionItem key={value} value={value} disabled={value === "remove"}>
            <AccordionTrigger>{question}</AccordionTrigger>
            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  )
}

export function CollapsibleSection() {
  const [showAll, setShowAll] = useState(false)
  return (
    <Section
      id="collapsible"
      title="Collapsible"
      base="Collapsible"
      purpose="Shows or hides one block of extra detail."
    >
      <Collapsible
        open={showAll}
        onOpenChange={setShowAll}
        className="grid w-full max-w-[420px] gap-1 justify-self-center"
      >
        <div className="flex items-center justify-between gap-3">
          <strong className="text-body font-semibold">Weekly buyer has 8 limits</strong>
          <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
            <Icon name={showAll ? "collapse" : "expand"} size={16} />
            {showAll ? "Show less" : "Show all"}
          </CollapsibleTrigger>
        </div>
        <Limits rows={LIMITS.slice(0, 3)} />
        <CollapsibleContent>
          <Limits rows={LIMITS.slice(3)} />
        </CollapsibleContent>
      </Collapsible>
    </Section>
  )
}

export function CarouselSection() {
  return (
    <Section
      id="carousel"
      title="Carousel"
      base="Carousel (Embla)"
      purpose="A row of cards you page through with arrows, dots, the arrow keys, or by dragging and swiping."
    >
      <Carousel aria-label="Agent templates">
        <CarouselContent>
          {AGENTS.map((agent, i) => (
            <CarouselItem key={agent.id} aria-label={`${i + 1} of ${AGENTS.length}`}>
              <TemplateCard agent={agent} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselControls />
      </Carousel>
      <div className="grid gap-2">
        <span className="text-caption font-semibold text-g-400">Looping, one at a time</span>
        <Carousel aria-label="Agent templates, looping" opts={{ loop: true }} className="max-w-[360px]">
          <CarouselContent>
            {AGENTS.map((agent, i) => (
              <CarouselItem
                key={agent.id}
                aria-label={`${i + 1} of ${AGENTS.length}`}
                className="min-[600px]:basis-full min-[1100px]:basis-full"
              >
                <TemplateCard agent={agent} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselControls />
        </Carousel>
      </div>
    </Section>
  )
}

export function ResizableSection() {
  return (
    <Section
      id="resizable"
      title="Resizable"
      base="Resizable (react-resizable-panels)"
      flush
      purpose="Panels you can resize by dragging the handle, or with the arrow keys when it's focused."
    >
      <div className="h-[260px]">
        <ResizablePanelGroup>
          <ResizablePanel id="agents" defaultSize="34%" minSize="20%" maxSize="80%">
            <div className="grid content-start gap-2.5 p-4 text-[13.5px]">
              <span className="text-caption font-semibold text-g-400">Agents</span>
              {AGENTS.slice(0, 3).map((agent) => (
                <span key={agent.id} className="flex items-center gap-2">
                  <Icon name={agent.icon} size={16} className="text-blue" />
                  {agent.name}
                </span>
              ))}
            </div>
          </ResizablePanel>
          <ResizableHandle aria-label="Resize agents panel" />
          <ResizablePanel id="workspace" minSize="20%">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel id="chat" defaultSize="55%" minSize="20%" maxSize="80%">
                <div className="grid content-start gap-2.5 p-4 text-[13.5px]">
                  <span className="text-caption font-semibold text-g-400">Chat</span>
                  <p className="text-label text-g-600">“Create an agent that can only rebalance my portfolio.”</p>
                </div>
              </ResizablePanel>
              <ResizableHandle aria-label="Resize chat panel" />
              <ResizablePanel id="limits" minSize="20%">
                <div className="grid content-start gap-2.5 p-4 text-[13.5px]">
                  <span className="text-caption font-semibold text-g-400">Limits preview</span>
                  <p className="text-label text-g-600">Rebalance only · Max 25% in one stock · Cash reserve $200</p>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="h-[140px] border-t border-g-100">
        <ResizablePanelGroup>
          <ResizablePanel id="sidebar" defaultSize="28%" minSize="18%" collapsible collapsedSize="0%">
            <div className="grid content-start gap-1 p-4 text-[13.5px]">
              <span className="text-caption font-semibold text-g-400">Collapsible · no grip</span>
              <p className="text-label text-g-600">
                Drag past the edge, or press Enter on the line, to fold it away.
              </p>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle={false} aria-label="Resize activity panel" />
          <ResizablePanel id="activity">
            <div className="grid content-start gap-1 p-4 text-[13.5px]">
              <span className="text-caption font-semibold text-g-400">Activity</span>
              <p className="text-label text-g-600">Rebalancer bought $40.00 of Apple · 2 minutes ago</p>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </Section>
  )
}
