import type { Agent } from "@bluechip/domain/agents/Agent"
import { describeSpec } from "@bluechip/domain/policies/Catalog"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { ButterflyAssemble } from "@bluechip/ui/motion/butterfly-assemble"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { cashDialogAtom } from "../../../../atoms/cashDialog.ts"
import { portfolioAtom } from "../../../../atoms/portfolio.ts"
import { useStockLookup } from "../../../../hooks/useStockLookup.ts"
import { dayLabel } from "../../model/fieldText.ts"

/**
 * The new agent, live: its butterfly, how long its rules are locked, what it can do now (three lines at most), its
 * automations, and where to go next. Without cash it has nothing to trade with, so adding cash comes first.
 */
export function DoneStep({ agent, automations }: Readonly<{ agent: Agent; automations: ReactNode }>) {
  const { nameOf } = useStockLookup()
  const portfolio = useAtomValue(portfolioAtom)
  const openCash = useAtomSet(cashDialogAtom)

  const can = describeSpec(agent.spec, nameOf).can.slice(0, 3)
  const until = agent.lockedUntil === null ? null : dayLabel(agent.lockedUntil)
  const noCash = AsyncResult.isSuccess(portfolio) && portfolio.value.cash === BigInt(0)
  const goTo = (
    <ButtonLink
      variant={noCash ? "secondary" : "primary"}
      render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
      className="min-w-[150px] flex-1"
    >
      Go to {agent.name}
      <Icon name="arrow-right" size={16} />
    </ButtonLink>
  )

  return (
    <div className="mx-auto grid w-full max-w-[480px] rounded-lg bg-white px-6 pt-6 pb-7 shadow-e2">
      <Outcome
        tone="success"
        size="page"
        media={
          <ButterflyAssemble agentId={agent.id} label={`${agent.name}'s butterfly`} className="h-[132px] w-[180px]" />
        }
        title={`${agent.name} is live`}
        description={until === null ?
          "Its rules are locked with Face ID. Pause it any time." :
          `Locked with Face ID until ${until}. Pause it any time.`}
        actions={
          <>
            <ButtonLink variant="secondary" render={<Link to="/agents" />} className="min-w-[150px] flex-1">
              See all agents
            </ButtonLink>
            {goTo}
            {noCash ?
              (
                <Button onClick={() => openCash("add")} className="min-w-[150px] flex-1">
                  <Icon name="plus" size={16} />Add cash
                </Button>
              ) :
              null}
          </>
        }
      >
        {can.length === 0 ?
          null :
          (
            <ul aria-label="It can" className="grid gap-1.5 rounded-[12px] px-3.5 py-3 surface-well">
              {can.map((line) => (
                <li key={line} className="grid grid-cols-[18px_minmax(0,1fr)] gap-1.5 text-[13.5px] text-g-800">
                  <Icon name="check" size={14} className="mt-[3px] text-gain" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        {automations}
        {noCash
          ? <p className="text-center text-label-sm text-g-500">It needs cash in your account to trade.</p>
          : null}
      </Outcome>
    </div>
  )
}
