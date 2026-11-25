import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import type { ComponentType } from "react"
import type { EditorProps } from "./editorProps.ts"
import { FairPriceEditor } from "./FairPriceEditor.tsx"
import { GenericEditor } from "./GenericEditor.tsx"
import { RebalanceEditor } from "./RebalanceEditor.tsx"
import { TradeEditor } from "./TradeEditor.tsx"
import { TradeSizeEditor } from "./TradeSizeEditor.tsx"
import { TradesPerDayEditor } from "./TradesPerDayEditor.tsx"

// Policies with words or couplings of their own; every other one is edited from its fields' hints.
const EDITORS: Partial<Record<PolicyId, ComponentType<EditorProps>>> = {
  trade: TradeEditor,
  tradeSize: TradeSizeEditor,
  fairPrice: FairPriceEditor,
  rebalance: RebalanceEditor,
  tradesPerDay: TradesPerDayEditor
}

/** One policy's editor: its own, or the one built from its fields. */
export function PolicyEditor(props: EditorProps) {
  const Editor = EDITORS[props.id] ?? GenericEditor
  return <Editor {...props} />
}
