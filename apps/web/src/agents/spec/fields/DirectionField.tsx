import { Direction } from "@bluechip/domain/policies/Trade"
import { DIRECTION_LABELS } from "../fieldText.ts"
import { ChoiceField } from "./ChoiceField.tsx"

const HELP: Readonly<Record<Direction, string>> = {
  both: "It may buy and sell the stocks you pick.",
  buy: "It only ever buys. It can never sell what you hold.",
  sell: "It only ever sells, so it never spends your cash.",
  rebalance: "It only trades to bring you back to your target mix, so it comes with one."
}

/** Which way it trades; rebalancing comes with a target mix. */
export function DirectionField(
  { label, value, problem, onChange }: Readonly<{
    label: string
    value: Direction
    problem?: string | undefined
    onChange: (direction: Direction) => void
  }>
) {
  return (
    <ChoiceField
      label={label}
      help={HELP[value]}
      value={value}
      options={Direction.literals.map((direction) => ({ value: direction, label: DIRECTION_LABELS[direction] }))}
      problem={problem}
      onChange={onChange}
    />
  )
}
