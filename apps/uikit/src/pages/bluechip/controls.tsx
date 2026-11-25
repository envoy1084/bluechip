import { Button } from "@bluechip/ui/components/button"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { card } from "./layout.tsx"

/* ---------- Demo controls ---------- */

export function DemoControls(
  { market, log, actions, onShow }: {
    readonly market: "open" | "closed"
    readonly log: { readonly text: string; readonly target: string } | null
    readonly actions: Readonly<Record<"market" | "blocked" | "approval" | "drop" | "deposit", () => void>>
    readonly onShow: (target: string) => void
  }
) {
  const controls: ReadonlyArray<readonly [keyof typeof actions, IconName, string, string]> = [
    [
      "market",
      market === "open" ? "moon" : "sun",
      market === "open" ? "Close the market" : "Open the market",
      "Market pills, stock rows, marquee"
    ],
    ["drop", "chart-down", "Drop TSLA 10%", "Prices, holdings, donut, stop-loss"],
    ["deposit", "cash", "Deposit arrives", "Deposit card, balances, activity"],
    ["blocked", "stop-sign", "Trigger a blocked trade", "Blocked card, activity"],
    ["approval", "hand", "Request approval", "Approval sheet, activity"]
  ]
  return (
    <div className={cn(card, "mt-8 overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-g-100 px-4 py-3.5">
        <span className="grid size-[26px] place-items-center rounded-sm bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white">
          <Icon name="play" size={14} />
        </span>
        <b className="text-body-sm">Demo controls</b>
        <span className="text-label-sm text-g-500">Drives the components on this page</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-2 p-3">
        {controls.map(([key, icon, title, touches]) => (
          <button
            key={key}
            type="button"
            onClick={actions[key]}
            className="flex cursor-pointer items-start gap-2.5 rounded-md px-3 py-[11px] text-left surface-secondary transition-[box-shadow,scale] duration-fast ease-brand hover:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(42,91,255,.3),0_3px_6px_-3px_rgba(42,91,255,.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue active:scale-98"
          >
            <Icon name={icon} size={16} className="mt-0.5 text-blue" />
            <span className="grid gap-px">
              <b className="text-[13.5px] font-semibold">{title}</b>
              <span className="text-caption text-g-500">{touches}</span>
            </span>
          </button>
        ))}
      </div>
      <div aria-live="polite" className="flex min-h-[50px] items-center border-t border-g-100 bg-[#fafafb] px-4 py-2.5">
        {log ?
          (
            <span className="flex w-full flex-wrap items-center gap-2 text-label text-g-700">
              <Icon name="check-circle" size={14} className="text-gain" />
              <span className="flex-1">{log.text}</span>
              <Button variant="ghost" size="sm" onClick={() => onShow(log.target)}>
                Show me<Icon name="arrow-down" size={14} />
              </Button>
            </span>
          ) :
          <span className="text-label-sm text-g-500">Nothing yet. Try a control.</span>}
      </div>
    </div>
  )
}
