import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { asOneLine } from "../../model/automationText.ts"
import type { DraftFields } from "../../model/drafts.ts"
import { SettingsFields } from "./SettingsFields.tsx"

/**
 * The rest of its settings, folded away with what they come to in words. A problem with them opens it, so the problem
 * can't hide.
 */
export function SettingsSection(
  { id, draft, zone, summary, problem, onChange }: Readonly<{
    id: string
    draft: DraftFields
    zone: string
    /** The settings in words, shown while folded. */
    summary: ReadonlyArray<string>
    problem: string | undefined
    onChange: (settings: DraftFields["settings"]) => void
  }>
) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      id={id}
      tabIndex={-1}
      open={open || problem !== undefined}
      onOpenChange={setOpen}
      className="scroll-mt-[84px] overflow-hidden rounded-lg bg-white shadow-e2 outline-none"
    >
      <CollapsibleTrigger className="group/settings flex w-full cursor-pointer items-center gap-3 px-[18px] py-4 text-left outline-none focus-visible:bg-g-50">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-g-100 text-g-600 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]"
        >
          <Icon name="settings" size={14} />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">More settings</span>
          <span className="text-label text-g-500">
            {summary.length === 0 ? "Runs every time, with no wait." : asOneLine(summary)}
          </span>
        </span>
        <Icon
          name="chevron-down"
          size={16}
          className="shrink-0 text-g-500 transition-transform duration-base ease-brand group-data-panel-open/settings:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-g-100 px-[18px] pt-4 pb-[18px]">
          <SettingsFields draft={draft} zone={zone} quietProblem={problem} onChange={onChange} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
