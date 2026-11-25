import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import {
  addPolicy,
  cantAdd,
  cantRemove,
  hasPolicy,
  removePolicy,
  VISIBLE_POLICIES
} from "@bluechip/domain/policies/SpecEdits"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { useId } from "react"
import { type ChangeKind, ChangeMark, PolicySection } from "./fields/PolicySection.tsx"

const joined = (words: ReadonlyArray<string>): string =>
  words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`

// What turning a policy on or off does besides itself, said before it happens.
const sideEffect = (spec: AgentSpec, id: PolicyId, on: boolean): string | undefined => {
  if (id === "rebalance") {
    return on ?
      "Turning it off lets it buy and sell freely instead." :
      "Turning it on makes it trade only toward your mix, on live prices."
  }
  const missing = policyOf(id).requires.filter((needed) => !hasPolicy(spec, needed as PolicyId))
  return !on && missing.length > 0 ?
    `Adds ${joined(missing.map((needed) => policyOf(needed as PolicyId).title.toLowerCase()))} too.` :
    undefined
}

function OptionalPolicy(
  { spec, id, change, onChange }: Readonly<{
    spec: AgentSpec
    id: PolicyId
    change: ChangeKind | undefined
    onChange: (spec: AgentSpec) => void
  }>
) {
  const policy = policyOf(id)
  const on = hasPolicy(spec, id)
  const blocked = on ? cantRemove(spec, id) : cantAdd(spec, id)
  const note = blocked ?? sideEffect(spec, id, on)
  const switchId = useId()

  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="grid gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <label htmlFor={switchId} className="text-[13.5px] font-medium text-g-800">{policy.title}</label>
          <ChangeMark change={change} />
        </span>
        <span className="text-label-sm text-g-500">{policy.summary}</span>
        {note === undefined ? null : <span className="text-label-sm text-g-600">{note}</span>}
      </div>
      <Switch
        id={switchId}
        checked={on}
        disabled={blocked !== undefined}
        onCheckedChange={(checked) => onChange(checked ? addPolicy(spec, id) : removePolicy(spec, id))}
      />
    </li>
  )
}

/**
 * Which policies the agent carries: the ones every agent has, fixed, and the optional ones to add or remove, each
 * saying what it needs or what else it changes.
 */
export function PolicyPicker(
  { spec, changeOf, onChange }: Readonly<{
    spec: AgentSpec
    changeOf: (id: PolicyId) => ChangeKind | undefined
    onChange: (spec: AgentSpec) => void
  }>
) {
  const required = VISIBLE_POLICIES.filter((policy) => policy.required)
  const optional = VISIBLE_POLICIES.filter((policy) => !policy.required)

  return (
    <PolicySection title="Rules it follows" description="Each rule is checked onchain on every trade it makes.">
      <p className="flex items-start gap-1.5 text-label-sm text-g-600">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
        Every agent has {joined(required.map((policy) => policy.title.toLowerCase()))}.
      </p>
      <ul className="grid divide-y divide-g-100">
        {optional.map((policy) => (
          <OptionalPolicy
            key={policy.id}
            spec={spec}
            id={policy.id}
            change={changeOf(policy.id)}
            onChange={onChange}
          />
        ))}
      </ul>
    </PolicySection>
  )
}
