import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { AspectRatio } from "@bluechip/ui/components/aspect-ratio"
import { Button } from "@bluechip/ui/components/button"
import { ScrollArea } from "@bluechip/ui/components/scroll-area"
import { Separator } from "@bluechip/ui/components/separator"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { STOCKS, TRADES } from "./data.ts"
import { Change, Demo, Section, Ticker } from "./layout.tsx"

export function SeparatorSection() {
  return (
    <Section
      title="Separator"
      purpose="A hairline between groups. Decorative unless it separates real sections."
      base="Separator"
    >
      <Demo>
        <div className="grid w-full max-w-[520px] gap-4">
          <div>
            <strong className="text-[15px] font-semibold">Rebalancer</strong>
            <p className="text-label-sm text-g-500">Keeps your mix on target.</p>
          </div>
          <Separator />
          <div className="flex h-4 items-center gap-3.5 text-[13.5px] text-g-600">
            <span>Limits</span>
            <Separator orientation="vertical" />
            <span>Activity</span>
            <Separator orientation="vertical" />
            <span>Settings</span>
          </div>
          <div className="flex items-center gap-3 text-caption text-g-400">
            <Separator className="flex-1" />
            <span>or</span>
            <Separator className="flex-1" />
          </div>
          <Button variant="secondary" className="w-full">
            <Icon name="face-id" size={16} />Continue with Face ID
          </Button>
        </div>
      </Demo>
    </Section>
  )
}

export function AspectRatioSection() {
  return (
    <Section
      title="Aspect ratio"
      purpose="Keeps media at a fixed shape at any width: share cards, charts, art."
      base="AspectRatio"
    >
      <div className="grid grid-cols-2 items-end gap-4 md:grid-cols-[2fr_1fr_0.9fr]">
        <figure className="col-span-2 grid gap-2 md:col-span-1">
          <AspectRatio ratio={16 / 9} className="rounded-lg bg-white shadow-e1">
            <Halftone scene="market" still interactive={false} />
          </AspectRatio>
          <figcaption className="text-label-sm font-medium text-g-500">16 : 9 · share card</figcaption>
        </figure>
        <figure className="grid gap-2">
          <AspectRatio ratio={1} className="rounded-lg bg-white shadow-e1">
            <Halftone scene="logo" still interactive={false} />
          </AspectRatio>
          <figcaption className="text-label-sm font-medium text-g-500">1 : 1 · avatar art</figcaption>
        </figure>
        <figure className="grid gap-2">
          <AspectRatio
            ratio={4 / 5}
            className="grid place-items-center rounded-lg bg-sunken bg-[radial-gradient(rgba(10,11,13,.07)_1px,transparent_1px)] bg-size-[12px_12px] shadow-e1 *:size-auto"
          >
            <AgentAvatar agentId="weekly-buyer" size="xl" />
          </AspectRatio>
          <figcaption className="text-label-sm font-medium text-g-500">4 : 5 · story</figcaption>
        </figure>
      </div>
    </Section>
  )
}

export function ScrollAreaSection() {
  return (
    <Section
      title="Scroll area"
      purpose="A scrolling region with a slim, quiet scrollbar that still works with keyboard and wheel."
      base="ScrollArea"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
        <ScrollArea aria-label="Recent activity" className="h-60 rounded-lg bg-white shadow-e1">
          <div className="px-3.5 py-1.5">
            {TRADES.slice(0, 14).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2.5 border-b border-g-100 py-[9px] text-[13.5px] last:border-b-0"
              >
                <Ticker symbol={t.symbol} />
                <span className="min-w-0 flex-1">
                  {t.agent.name} · {t.side === "Buy" ? "bought" : "sold"} {formatMoney(t.amount)}
                </span>
                <span className="text-label-sm text-g-500 tabular-nums">Nov {t.day}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <ScrollArea aria-label="Stocks" orientation="horizontal" className="rounded-lg bg-white shadow-e1">
          <div className="flex w-max gap-2.5 p-3.5">
            {STOCKS.map((s) => (
              <div
                key={s.symbol}
                className="grid w-32 justify-items-start gap-1 rounded-[12px] bg-g-50 p-3 text-label shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]"
              >
                <Ticker symbol={s.symbol} large />
                <strong className="mt-1 font-semibold">{s.name}</strong>
                <span className="tabular-nums">{formatMoney(s.price)}</span>
                <Change value={s.change} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Section>
  )
}
