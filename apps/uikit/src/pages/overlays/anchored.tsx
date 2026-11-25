import { Badge } from "@bluechip/ui/components/badge"
import { Button } from "@bluechip/ui/components/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@bluechip/ui/components/hover-card"
import { InputGroup, InputGroupInput, InputGroupText } from "@bluechip/ui/components/input-group"
import { Label } from "@bluechip/ui/components/label"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger
} from "@bluechip/ui/components/popover"
import { toast } from "@bluechip/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@bluechip/ui/components/tooltip"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { AgentTile, Section, Ticker } from "./layout.tsx"

export function AnchoredSections({ open }: { readonly open: string | undefined }) {
  const [gap, setGap] = useState(["1%"])

  return (
    <>
      <Section
        id="popover"
        title="Popover"
        base="Popover"
        purpose="Rich content anchored to a trigger: a short explainer or a small form. Not modal."
      >
        <Popover defaultOpen={open === "popover"}>
          <PopoverTrigger render={<Button variant="secondary" />}>
            <Icon name="info" size={16} />Fair price check
          </PopoverTrigger>
          <PopoverContent>
            <PopoverTitle>
              <span className="grid size-7 place-items-center rounded-sm bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
                <Icon name="scales" size={16} />
              </span>
              Fair price check
            </PopoverTitle>
            <PopoverDescription>
              Before any trade, bluechip compares the price to the market. If it's more than {gap[0]}{" "}
              off, the trade doesn't happen.
            </PopoverDescription>
            <div className="flex items-center justify-between gap-3">
              <span className="text-label font-semibold">Allowed gap</span>
              <ToggleGroup
                aria-label="Allowed gap"
                value={gap}
                onValueChange={(next) => next.length > 0 && setGap(next)}
              >
                {["0.5%", "1%", "2%"].map((value) => (
                  <ToggleGroupItem key={value} value={value} size="sm">{value}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            Approval amount<Icon name="chevron-down" size={16} />
          </PopoverTrigger>
          <PopoverContent align="end" aria-label="Approval amount">
            <div className="grid gap-1.5">
              <Label htmlFor="approval-amount">Ask me above</Label>
              <InputGroup>
                <InputGroupText>$</InputGroupText>
                <InputGroupInput id="approval-amount" defaultValue="500" inputMode="decimal" />
              </InputGroup>
              <p className="text-label text-g-500">Trades above this wait for Face ID.</p>
            </div>
            <div className="flex justify-end gap-2">
              <PopoverClose render={<Button variant="ghost" size="sm" />}>Cancel</PopoverClose>
              <PopoverClose render={<Button size="sm" />} onClick={() => toast.success("Approval amount saved")}>
                Save
              </PopoverClose>
            </div>
          </PopoverContent>
        </Popover>
      </Section>

      <Section
        id="hover-card"
        title="Hover card"
        base="PreviewCard"
        purpose="A preview on hover or focus, for people who want a peek before they click."
      >
        <p className="max-w-[44ch] text-center text-body text-g-700">
          Last trade by{" "}
          <HoverCard defaultOpen={open === "hover-card"}>
            <HoverCardTrigger
              href="#hover-card"
              className="font-[550] text-blue underline decoration-blue/30 underline-offset-3 hover:decoration-blue"
            >
              Rebalancer
            </HoverCardTrigger>
            <HoverCardContent>
              <div className="flex items-start gap-3">
                <AgentTile icon="scales" />
                <div className="grid flex-1 gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[14.5px] font-semibold">Rebalancer</strong>
                    <Badge variant="success">Running</Badge>
                  </div>
                  <p className="text-label leading-snug text-g-600">
                    Keeps your mix on target. Only rebalances, never adds cash.
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 border-t border-g-100 pt-3">
                {[["Trades this week", "6"], ["Stopped by limits", "1"], ["Since", "Oct 2026"]].map((
                  [term, value]
                ) => (
                  <div key={term} className="grid gap-px">
                    <dt className="text-[11.5px] text-g-500">{term}</dt>
                    <dd className="text-body-sm font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </HoverCardContent>
          </HoverCard>: sold 1 <Ticker symbol="TSLA" /> to bring Tesla back under 25%.
        </p>
      </Section>

      <Section
        id="tooltip"
        title="Tooltip"
        base="Tooltip"
        purpose="A short label for an icon-only control. Shows on hover after a beat, and on keyboard focus right away."
      >
        {([
          ["pause", "Pause agent", "top", undefined],
          ["copy", "Copy address", "bottom", undefined],
          ["refresh", "Refresh prices", "left", "R"],
          ["help", "How limits work", "right", undefined]
        ] as const).map(([icon, label, side, shortcut], i) => (
          <Tooltip key={label} defaultOpen={open === "tooltip" && i === 2}>
            <TooltipTrigger render={<Button variant="secondary" size="icon" aria-label={label} />}>
              <Icon name={icon} size={18} />
            </TooltipTrigger>
            <TooltipContent side={side} shortcut={shortcut}>{label}</TooltipContent>
          </Tooltip>
        ))}
      </Section>
    </>
  )
}
