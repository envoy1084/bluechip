import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { addPolicy, cantAdd, cantRemove, hasPolicy, removePolicy } from "@bluechip/domain/policies/SpecEdits"
import { PolicyRow } from "@bluechip/ui/bluechip/policy-row"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { policySummary } from "../../model/policySections.ts"
import { type ChangeKind, ChangeMark } from "./ChangeMark.tsx"
import { PolicyEditor } from "./editors/PolicyEditor.tsx"
import type { FieldContext } from "./fields/FieldEditor.tsx"

const joined = (words: ReadonlyArray<string>): string =>
  words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`

// What turning a policy on or off does besides itself, said before it happens.
const sideEffect = (spec: AgentSpec, id: PolicyId, on: boolean): string | undefined => {
  if (id === "rebalance") {
    return on ?
      "Turning it off lets it buy and sell freely instead." :
      "Turning it on makes it trade only toward your mix."
  }
  const missing = policyOf(id).requires.filter((needed) => !hasPolicy(spec, needed as PolicyId))
  return !on && missing.length > 0 ?
    `Adds ${joined(missing.map((needed) => policyOf(needed as PolicyId).title.toLowerCase()))} too.` :
    undefined
}

/**
 * One of the agent's rules as a row: what it does now and Edit, or, for an optional rule it doesn't carry, what it
 * would do. Optional rules carry a switch, saying what else it changes or why it can't change; every agent's own rules
 * carry a lock.
 */
export function RuleRow(
  { id, context, nameOf, change, open, onOpenChange, problem, held, problemOf, onSpecChange }: Readonly<{
    id: PolicyId
    context: FieldContext
    nameOf: (symbol: StockSymbol) => string
    change: ChangeKind | undefined
    open: boolean
    onOpenChange: (open: boolean) => void
    /** What about the rule as a whole blocks locking: said in its header, and it keeps the row open. */
    problem: string | undefined
    /** One of its fields has a problem, shown under that field: the row stays open. */
    held: boolean
    problemOf: (field: string) => string | undefined
    onSpecChange: (spec: AgentSpec) => void
  }>
) {
  const { spec } = context
  const policy = policyOf(id)
  const on = hasPolicy(spec, id)
  const blocked = on ? cantRemove(spec, id) : cantAdd(spec, id)
  const note = policy.required ? undefined : blocked ?? sideEffect(spec, id, on)

  return (
    <PolicyRow
      title={policy.title}
      off={!on}
      open={open || held}
      onOpenChange={onOpenChange}
      badge={<ChangeMark change={change} />}
      problem={problem}
      summary={policySummary(spec, id, nameOf)}
      control={policy.required ?
        <Icon name="lock" size={16} label="Every agent has this rule" className="text-g-400" /> :
        (
          <Switch
            aria-label={policy.title}
            // What switching it also changes, or why it can't be switched, kept off the one-line summary.
            title={note}
            aria-description={note}
            checked={on}
            disabled={blocked !== undefined}
            onCheckedChange={(checked) => onSpecChange(checked ? addPolicy(spec, id) : removePolicy(spec, id))}
          />
        )}
    >
      {on ? <PolicyEditor id={id} context={context} problemOf={problemOf} onSpecChange={onSpecChange} /> : null}
    </PolicyRow>
  )
}
