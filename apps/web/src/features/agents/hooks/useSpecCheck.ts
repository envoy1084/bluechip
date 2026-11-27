import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import type { SpecCheck } from "@bluechip/domain/policies/Catalog"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useEffect, useState } from "react"
import { checkSpecAtom } from "../atoms/policies.ts"

type SpecChecking =
  | { readonly status: "checking" }
  | { readonly status: "checked"; readonly check: SpecCheck }
  | { readonly status: "failed" }

/**
 * bluechip's reading of a draft (`POST /sessions/check`): what blocks locking it, what it lets the agent do, and, with
 * `before`, how it compares with the policies in force. `retry` asks again after a failure.
 */
export function useSpecCheck(spec: AgentSpec, before: AgentSpec | null) {
  const check = useAtomSet(checkSpecAtom, { mode: "promise" })
  const [checking, setChecking] = useState<SpecChecking>({ status: "checking" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    setChecking({ status: "checking" })
    check({ payload: { spec, before } }).then(
      (result) => current && setChecking({ status: "checked", check: result }),
      () => current && setChecking({ status: "failed" })
    )
    return () => {
      current = false
    }
  }, [check, spec, before, attempt])

  return { checking, retry: () => setAttempt((count) => count + 1) }
}
