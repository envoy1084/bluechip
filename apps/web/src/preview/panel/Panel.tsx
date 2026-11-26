// The god mode panel: a pill in the corner saying which account the tab previews, opening (or Cmd+.) a drawer with a
// tab per part of the app to switch it into any state.
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { type ComponentType, useEffect, useState } from "react"
import { SCENARIOS } from "../world/cast.ts"
import { usePreview } from "./controls.tsx"
import { AccountSection } from "./sections/AccountSection.tsx"
import { AgentsSection } from "./sections/AgentsSection.tsx"
import { AssistantSection } from "./sections/AssistantSection.tsx"
import { NetworkSection, ScenarioSection } from "./sections/CoreSections.tsx"
import { MarketSection } from "./sections/MarketSection.tsx"

const SECTIONS: ReadonlyArray<{ readonly id: string; readonly label: string; readonly Section: ComponentType }> = [
  { id: "scenario", label: "Account", Section: ScenarioSection },
  { id: "market", label: "Money", Section: MarketSection },
  { id: "agents", label: "Agents", Section: AgentsSection },
  { id: "assistant", label: "Chat", Section: AssistantSection },
  { id: "account", label: "Security", Section: AccountSection },
  { id: "network", label: "Network", Section: NetworkSection }
]

const TAB_KEY = "bluechip:preview:tab"

export function Panel() {
  const store = usePreview()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(() => sessionStorage.getItem(TAB_KEY) ?? "scenario")
  const scenario = SCENARIOS.find((candidate) => candidate.id === store.scenario)!
  const Section = (SECTIONS.find((section) => section.id === tab) ?? SECTIONS[0]!).Section

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault()
        setOpen((was) => !was)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const choose = (id: string) => {
    setTab(id)
    sessionStorage.setItem(TAB_KEY, id)
  }

  return (
    <div className="font-sans text-ink">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        className="fixed bottom-4 left-4 z-[2147483000] inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-e3 transition-transform hover:scale-[1.03]"
      >
        <i className="size-2 rounded-full bg-[#7cf2a5] shadow-[0_0_0_3px_rgba(124,242,165,.25)]" />
        Preview: {scenario.label}
        {store.actions.length === 0 ?
          null :
          <span className="rounded-full bg-white/15 px-1.5 text-[11px] tabular-nums">{store.actions.length}</span>}
        <kbd className="text-[11px] font-medium text-white/60">⌘.</kbd>
      </button>

      <aside
        aria-label="Preview controls"
        className={cn(
          "fixed top-3 right-3 bottom-3 z-[2147483001] grid w-[380px] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-[16px] bg-white shadow-e3 ring-1 ring-ink/5 transition-[translate,opacity] duration-300 ease-brand",
          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+24px)] opacity-0"
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-g-100 px-4 py-3">
          <div className="grid gap-0.5">
            <b className="text-[14px] font-semibold tracking-[-0.01em]">God mode</b>
            <span className="text-[12px] text-g-500">Made-up data, served in this tab. Nothing is real.</span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="grid size-8 cursor-pointer place-items-center rounded-full text-g-500 hover:bg-g-100 hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-g-100 px-3 py-2">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => choose(section.id)}
              className={cn(
                "cursor-pointer rounded-[8px] px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap transition-colors",
                section.id === tab ? "bg-ink text-white" : "text-g-600 hover:bg-g-100 hover:text-ink"
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div className="overflow-y-auto">
          <Section />
        </div>
      </aside>
    </div>
  )
}
