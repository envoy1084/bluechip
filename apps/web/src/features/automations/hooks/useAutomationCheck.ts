import { type AutomationDraft, checkAutomation, describeAutomation } from "@bluechip/domain/automations/Automation"
import type { AutomationCheck } from "@bluechip/domain/automations/Catalog"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useEffect, useMemo, useState } from "react"
import { checkAutomationAtom } from "../atoms/automations.ts"

type Checking =
  | { readonly status: "checking" }
  | { readonly status: "checked"; readonly check: Pick<AutomationCheck, "problems" | "description"> }
  | { readonly status: "failed" }

// Typing in a field changes the draft on every key; bluechip reads it once the typing settles.
const SETTLE_MS = 250

/**
 * bluechip's reading of a draft as it is edited: what can't run and what it does in sentences. Saved agents and your
 * own automations are read by bluechip (`POST /automations/check`); an agent not saved yet (`unsaved`, in the new
 * agent's flow) is read here, with the same catalog, against the rules it is about to lock.
 */
export function useAutomationCheck(
  draft: AutomationDraft,
  unsaved?: { readonly spec: AgentSpec; readonly nameOf: (symbol: StockSymbol) => string }
) {
  const check = useAtomSet(checkAutomationAtom, { mode: "promise" })
  const [checking, setChecking] = useState<Checking>({ status: "checking" })
  const [attempt, setAttempt] = useState(0)

  const local = useMemo(
    () =>
      unsaved === undefined ?
        null :
        {
          problems: checkAutomation(draft, complete(unsaved.spec)),
          description: describeAutomation(draft, unsaved.nameOf)
        },
    [draft, unsaved]
  )

  useEffect(() => {
    if (local !== null) return
    let current = true
    setChecking({ status: "checking" })
    const timer = setTimeout(() => {
      check({ payload: { draft } }).then(
        (result) => current && setChecking({ status: "checked", check: result }),
        () => current && setChecking({ status: "failed" })
      )
    }, SETTLE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [check, draft, local, attempt])

  return {
    checking: local === null ? checking : { status: "checked", check: local } as Checking,
    retry: () => setAttempt((count) => count + 1)
  }
}
