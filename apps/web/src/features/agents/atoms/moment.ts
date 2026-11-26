import type { AgentId } from "@bluechip/domain/Ids"
import * as Atom from "effect/reactivity/Atom"
import type { AgentMoment } from "../model/agentMoment.ts"

/** A moment that landed on one page and is said on the next: new rules on the agent's page, a removal on the list. */
export const agentMomentAtom = Atom.make<
  { readonly agentId: AgentId; readonly name: string; readonly moment: AgentMoment } | null
>(null)
