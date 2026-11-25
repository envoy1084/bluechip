import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { describeSpec } from "@bluechip/domain/policies/Catalog"
import { AgentStatus } from "@bluechip/ui/bluechip/agent-status"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { ButterflyAssemble } from "@bluechip/ui/motion/butterfly-assemble"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { dayLabel } from "../../../../../agents/spec/fieldText.ts"
import { stocksAtom } from "../../../../../atoms/market.ts"

/** Step five: the new agent, live, with what it does said once more and the way to it. */
export function DoneStep({ agent }: Readonly<{ agent: Agent }>) {
  const stocks = useAtomValue(stocksAtom)
  const nameOf = (symbol: StockSymbol) =>
    (AsyncResult.isSuccess(stocks) ? stocks.value.find((stock) => stock.symbol === symbol)?.name : undefined) ?? symbol

  const [trade] = describeSpec(agent.spec, nameOf).can
  const until = agent.lockedUntil === null ? null : dayLabel(DateTime.toDateUtc(agent.lockedUntil))

  return (
    <div className="mx-auto grid w-full max-w-[480px] justify-items-center gap-2.5 rounded-lg bg-white px-[26px] pt-7 pb-[26px] text-center shadow-e2">
      <ButterflyAssemble agentId={agent.id} label={`${agent.name}'s butterfly`} className="mb-1 h-[150px] w-[200px]" />
      <AgentStatus state="active" />
      <h3 className="text-2xl font-semibold tracking-[-0.03em]">{agent.name} is live</h3>
      <p className="mb-1.5 max-w-[42ch] text-[14.5px] text-g-600">
        {until === null ? "Its rules are locked with Face ID." : `Its rules are locked with Face ID until ${until}.`}
        {" "}
        It can{" "}
        {trade === undefined ? "trade only inside them" : `${trade.charAt(0).toLowerCase()}${trade.slice(1)}`}, and you
        can pause it any time.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button nativeButton={false} render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}>
          Go to {agent.name}
          <Icon name="arrow-right" size={16} />
        </Button>
        <Button variant="secondary" nativeButton={false} render={<Link to="/agents" />}>See all agents</Button>
      </div>
    </div>
  )
}
