import type { User } from "@bluechip/domain/Account"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { activityAtom } from "../../../atoms/activity.ts"
import { agentsAtom } from "../../../atoms/agents.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { accountRecoveryAtom } from "../../../atoms/recovery.ts"
import { setupSteps, type Stage, stageOf, type Step } from "../model/gettingStarted.ts"

/** Where you are with bluechip, once it's known: the stage and the first steps; `undefined` while it loads. */
export interface Setup {
  readonly stage: Stage
  readonly steps: ReadonlyArray<Step>
}

/**
 * Reads what you've done (money, agents, their trades, automations, a recovery key) into a stage and its steps.
 * Welcome needs only your money and agents; the rest waits for every read, so a step is never ticked wrongly. A read
 * that fails leaves it unknown. `hasAutomation` comes from the route, `undefined` until it's known.
 */
export function useSetup(user: User | undefined, hasAutomation: boolean | undefined, now: Date): Setup | undefined {
  const portfolio = useAtomValue(portfolioAtom)
  const agents = useAtomValue(agentsAtom)
  const trades = useAtomValue(activityAtom("trades all"))
  const recovery = useAtomValue(accountRecoveryAtom)

  if (user === undefined || !AsyncResult.isSuccess(portfolio) || !AsyncResult.isSuccess(agents)) return undefined

  const hasMoney = portfolio.value.value > BigInt(0)
  const partial = {
    hasMoney,
    agents: agents.value,
    agentTraded: AsyncResult.isSuccess(trades) &&
      trades.value.items.some((item) =>
        item._tag === "Trade" && item.trade.agentId !== null && item.trade.status === "filled"
      ),
    hasAutomation: hasAutomation ?? false,
    hasRecoveryKey: AsyncResult.isSuccess(recovery) && recovery.value.key !== null,
    signedUpAt: DateTime.toDateUtc(user.createdAt)
  }

  if (stageOf(partial, now) === "welcome") return { stage: "welcome", steps: setupSteps(partial) }
  if (!AsyncResult.isSuccess(trades) || !AsyncResult.isSuccess(recovery) || hasAutomation === undefined) {
    return undefined
  }

  return { stage: stageOf(partial, now), steps: setupSteps(partial) }
}
