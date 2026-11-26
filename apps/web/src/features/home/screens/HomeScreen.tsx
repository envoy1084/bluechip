import type { Automation } from "@bluechip/domain/automations/Automation"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { PortfolioSummarySkeleton } from "@bluechip/ui/bluechip/portfolio-summary"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { meAtom } from "../../../atoms/account.ts"
import { agentsAtom } from "../../../atoms/agents.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { accountRecoveryAtom } from "../../../atoms/recovery.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { useNow } from "../../../hooks/useNow.ts"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { ComingUpCard } from "../components/ComingUpCard.tsx"
import { GettingStarted } from "../components/GettingStarted.tsx"
import { Headline } from "../components/Headline.tsx"
import { MoneyCard } from "../components/MoneyCard.tsx"
import { MoversCard } from "../components/MoversCard.tsx"
import { NeedsYou } from "../components/NeedsYou.tsx"
import { useSetup } from "../hooks/useSetup.ts"
import { comingUp } from "../model/comingUp.ts"
import { movers } from "../model/holdings.ts"
import { type AutomationAttention, needsYou } from "../model/needsYou.ts"

/** An automation as home reads it, from the automations feature: what's next for it, and whether it needs a look. */
export interface HomeAutomation extends AutomationAttention {
  readonly automation: Pick<Automation, "id" | "name" | "status" | "nextRunAt" | "agentId" | "trigger">
}

const NOTHING: ReadonlyArray<never> = []

function valueOr<A>(result: AsyncResult.AsyncResult<ReadonlyArray<A>, unknown>): ReadonlyArray<A> {
  return AsyncResult.isSuccess(result) ? result.value : NOTHING
}

/**
 * Home, shaped by where you are: the day and the market, then your money (or a welcome when there's none yet), what
 * needs you, the first steps while you're getting started, your agents, and what's coming up and moving today.
 * Sections with nothing to say stay out. From the route: the approvals bell (`bell`) and the way to open the approvals
 * (`onReviewApprovals`), the trades waiting for you, your automations with what needs a look, and the agents' tiles.
 */
export function HomeScreen(
  { bell, approvals, automations, agents: agentTiles, onReviewApprovals }: Readonly<{
    bell: ReactNode
    approvals: AsyncResult.AsyncResult<ReadonlyArray<Pick<Intent, "agentId" | "expiresAt">>, unknown>
    automations: AsyncResult.AsyncResult<ReadonlyArray<HomeAutomation>, unknown>
    agents: ReactNode
    onReviewApprovals: () => void
  }>
) {
  const me = useAtomValue(meAtom)
  const portfolio = useAtomValue(portfolioAtom)
  const agents = useAtomValue(agentsAtom)
  const recovery = useAtomValue(accountRecoveryAtom)
  const { nameOf } = useStockLookup()
  const now = useNow(60_000)
  const setup = useSetup(
    AsyncResult.isSuccess(me) ? me.value.user : undefined,
    AsyncResult.isSuccess(automations) ? automations.value.length > 0 : undefined,
    now
  )
  if (!AsyncResult.isSuccess(me)) return null

  const welcome = setup?.stage === "welcome"
  const settled = setup?.stage === "settled"
  const emptyMoney = AsyncResult.isSuccess(portfolio) && portfolio.value.value === BigInt(0)
  const listed = valueOr(automations)
  const needs = needsYou(
    {
      approvals: valueOr(approvals),
      agents: valueOr(agents),
      automations: listed,
      recovery: AsyncResult.isSuccess(recovery) ? recovery.value : null,
      cash: AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : null,
      settled
    },
    now,
    localTimeZone()
  )
  const holdings = AsyncResult.isSuccess(portfolio) ? portfolio.value.holdings : NOTHING

  return (
    <AppPage title="Home" actions={bell}>
      <Headline displayName={me.value.user.displayName} now={now} />

      {welcome ?
        <GettingStarted steps={setup.steps} welcome /> :
        emptyMoney && !AsyncResult.isSuccess(agents) ?
        <PortfolioSummarySkeleton /> :
        <MoneyCard />}

      <NeedsYou needs={needs} onReviewApprovals={onReviewApprovals} />

      {setup?.stage === "starting" ? <GettingStarted steps={setup.steps} welcome={false} /> : null}

      {welcome ? null : agentTiles}

      <div className="grid gap-[18px] empty:hidden md:grid-cols-2 [&>*:only-child]:col-span-full">
        <ComingUpCard comingUp={comingUp(listed.map((each) => each.automation), valueOr(agents), now)} now={now} />
        <MoversCard movers={movers(holdings)} held={holdings.length} nameOf={nameOf} />
      </div>
    </AppPage>
  )
}
