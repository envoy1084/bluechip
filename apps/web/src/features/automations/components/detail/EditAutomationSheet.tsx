import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Automation } from "@bluechip/domain/automations/Automation"
import { Button } from "@bluechip/ui/components/button"
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@bluechip/ui/components/sheet"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { stocksAtom } from "../../../../atoms/market.ts"
import { useStockLookup } from "../../../../hooks/useStockLookup.ts"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { changedKeys, updateAutomationAtom } from "../../atoms/automations.ts"
import { draftFieldsOf } from "../../model/drafts.ts"
import { specOf, stocksOf, traderName } from "../../model/traders.ts"
import { AutomationEditor } from "../editor/AutomationEditor.tsx"

/** The editor in the sheet, once the stocks and its agent are in. Saving closes the sheet. */
function SheetEditor(
  { automation, agent, onSaved }: Readonly<{ automation: Automation; agent: Agent | null; onSaved: () => void }>
) {
  const stocks = useAtomValue(stocksAtom)
  const refresh = useAtomRefresh(stocksAtom)
  const update = useAtomSet(updateAutomationAtom, { mode: "promise" })
  const { nameOf } = useStockLookup()

  if (AsyncResult.isFailure(stocks)) {
    return (
      <p className="text-label text-g-600">
        We couldn't load the stocks just now.{" "}
        <button type="button" className="cursor-pointer font-semibold text-blue underline" onClick={refresh}>
          Try again
        </button>
      </p>
    )
  }
  if (!AsyncResult.isSuccess(stocks)) return <Spinner label="Loading the stocks" className="justify-self-center" />

  const spec = agent === null ? null : specOf(agent)
  return (
    <AutomationEditor
      initial={draftFieldsOf(automation)}
      context={{ stocks: stocksOf(spec, stocks.value), nameOf, zone: localTimeZone() }}
      spec={spec}
      whoTrades={automation.agentId === null || agent !== null ? traderName(agent) : "An agent that's gone"}
      saveLabel="Save changes"
      footer={<SheetClose render={<Button variant="ghost" size="lg" />}>Cancel</SheetClose>}
      compact
      onSave={async (draft) => {
        await update({ params: { id: automation.id }, payload: { draft }, reactivityKeys: changedKeys })
        onSaved()
      }}
    />
  )
}

/**
 * Edit, on an automation's page: the editor in a sheet over the page, so its runs stay where they were. `agent` is
 * `undefined` while the agents load.
 */
export function EditAutomationSheet(
  { automation, agent }: Readonly<{ automation: Automation; agent: Agent | null | undefined }>
) {
  const [open, setOpen] = useState(false)
  // An agent that's gone reads as none; one still loading waits.
  const trader = automation.agentId === null ? null : agent

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="secondary" size="sm" />}>
        <Icon name="edit" size={14} />Edit
      </SheetTrigger>
      <SheetContent className="w-[min(640px,100vw)]">
        <SheetHeader>
          <SheetTitle>Edit {automation.name}</SheetTitle>
          <SheetDescription>Changes count from its next run.</SheetDescription>
        </SheetHeader>
        <SheetBody className="bg-canvas px-4 pb-4 sm:px-6">
          {!open ? null : trader === undefined ?
            <Spinner label="Loading its agent" className="justify-self-center" /> :
            <SheetEditor automation={automation} agent={trader} onSaved={() => setOpen(false)} />}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
