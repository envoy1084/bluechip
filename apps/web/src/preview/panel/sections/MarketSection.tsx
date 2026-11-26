// The panel's Money tab: the market's session and prices, the account's cash and holdings, approvals waiting for you
// and agents' trades in any state.
import type { AgentId } from "@bluechip/domain/Ids"
import { WaitReason } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { useState } from "react"
import type { ApartSetting, FeedSetting, SessionSetting } from "../../world/market/model.ts"
import { type DayMove, LISTINGS } from "../../world/market/prices.ts"
import { canTrade } from "../../world/market/trading.ts"
import {
  advanceLatest,
  agentIntent,
  approval,
  deposit,
  expireApprovals,
  type IntentOutcome,
  ownFill,
  REFUSALS,
  setApart,
  setCash,
  setFeeds,
  setHoldings,
  setMissingPrice,
  setMove,
  setSession,
  setTicking,
  tickNow
} from "../actions/market.ts"
import { Act, Group, Pick, Row, Segmented, usePreview } from "../controls.tsx"

const WAIT_LABELS: Readonly<Record<WaitReason, string>> = {
  pricesPaused: "prices paused",
  pricesStale: "prices stale",
  noGas: "no ETH for gas",
  gasPrice: "gas too pricey",
  gasSpent: "gas budget spent",
  dayEnding: "day ending",
  unavailable: "Base down"
}

const OUTCOMES: ReadonlyArray<{ readonly value: IntentOutcome; readonly label: string }> = [
  { value: "filled", label: "Filled" },
  { value: "sending", label: "Sending" },
  { value: "confirming", label: "Confirming" },
  { value: "failed", label: "Failed" },
  { value: "proposed", label: "Proposed" },
  ...WaitReason.literals.map((reason) => ({
    value: `wait:${reason}` as const,
    label: `Waiting: ${WAIT_LABELS[reason]}`
  })),
  ...(Object.keys(REFUSALS) as Array<keyof typeof REFUSALS>).map((policy) => ({
    value: `blocked:${policy}` as const,
    label: `Blocked by ${policyOf(policy).title}`
  }))
]

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function MarketSection() {
  const store = usePreview()
  const market = store.world.market
  const agents = store.cast.agents.filter((agent) => agent.state !== "draft" && agent.state !== "locking")
  const traders = agents.filter(canTrade)
  const [agentId, setAgentId] = useState<string>(traders[0]?.id ?? agents[0]?.id ?? "")
  const [outcome, setOutcome] = useState<IntentOutcome>("filled")
  const [symbol, setSymbol] = useState<StockSymbol>("NVDA")

  const cash = Number(market.cash) / 1_000_000
  const held = [...market.holdings.values()].filter((shares) => shares > BigInt(0)).length
  const waiting =
    market.intents.filter(({ intent }) => intent.status === "needsApproval" || intent.status === "awaitingSignature")
      .length
  const trader = traders.find((agent) => agent.id === agentId) ?? traders[0]

  const play = (id: AgentId) => {
    store.act(agentIntent(id, "sending"))
    setTimeout(() => store.act(advanceLatest(id, "confirming")), 1_500)
    setTimeout(() => store.act(advanceLatest(id, "filled")), 3_300)
  }

  return (
    <>
      <Group title="Market" hint="The market badge, prices, charts and what trades warn about.">
        <Row label="Session">
          <Segmented<SessionSetting>
            value={market.session}
            options={[
              { value: "regular", label: "Open" },
              { value: "preMarket", label: "Pre-market" },
              { value: "afterHours", label: "After hours" },
              { value: "overnight", label: "Overnight" },
              { value: "weekend", label: "Weekend" },
              { value: "holiday", label: "Holiday" }
            ]}
            onChange={(session) => store.act(setSession(session))}
          />
        </Row>
        <Row label="Chainlink prices">
          <Segmented<FeedSetting>
            value={market.feeds}
            options={[{ value: "live", label: "Live" }, { value: "paused", label: "Paused" }, {
              value: "stale",
              label: "Stale"
            }]}
            onChange={(feeds) => store.act(setFeeds(feeds))}
          />
        </Row>
        <Row label="Prices apart">
          <Segmented<ApartSetting>
            value={market.apart}
            options={[
              { value: "none", label: "In line" },
              { value: "market", label: "Market 1.7% off" },
              { value: "pool", label: "Pools 1.6% off" }
            ]}
            onChange={(apart) => store.act(setApart(apart))}
          />
        </Row>
        <Row label="Today's move">
          <Segmented<DayMove>
            value={market.move}
            options={[
              { value: "mixed", label: "Mixed" },
              { value: "bigUp", label: "Big up" },
              { value: "flat", label: "Flat" },
              { value: "bigDown", label: "Big down" }
            ]}
            onChange={(move) => store.act(setMove(move))}
          />
        </Row>
        <Row label="Live ticks">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Segmented<"on" | "off">
                value={market.ticking ? "on" : "off"}
                options={[{ value: "on", label: "Every 5 s" }, { value: "off", label: "Still" }]}
                onChange={(ticking) => store.act(setTicking(ticking === "on"))}
              />
            </div>
            <Act onClick={() => store.act(tickNow())}>Tick now</Act>
          </div>
        </Row>
        <Row label="SpaceX price">
          <Segmented<"shown" | "missing">
            value={market.missingPrice ? "missing" : "shown"}
            options={[{ value: "shown", label: "Shown" }, { value: "missing", label: "Unavailable" }]}
            onChange={(shown) => store.act(setMissingPrice(shown === "missing"))}
          />
        </Row>
      </Group>

      <Group
        title="Money"
        hint={`${dollars.format(cash)} in cash, ${held} ${
          held === 1 ? "stock" : "stocks"
        }. Changes arrive as deposits and shares found outside bluechip.`}
      >
        <Row label="Cash">
          <Segmented<"none" | "some" | "lots">
            value={cash === 0 ? "none" : cash >= 1_000_000 ? "lots" : "some"}
            options={[{ value: "none", label: "None" }, { value: "some", label: "$2,480" }, {
              value: "lots",
              label: "$1.25M"
            }]}
            onChange={(level) => store.act(setCash(level))}
          />
        </Row>
        <Row label="Holdings">
          <Segmented<"none" | "some" | "many">
            value={held === 0 ? "none" : held <= 3 ? "some" : "many"}
            options={[{ value: "none", label: "None" }, { value: "some", label: "Three" }, {
              value: "many",
              label: "Thirteen"
            }]}
            onChange={(level) => store.act(setHoldings(level))}
          />
        </Row>
        <Row label="Deposit">
          <div className="flex flex-wrap gap-2">
            {[0.5, 500, 25_000].map((amount) => (
              <Act key={amount} onClick={() => store.act(deposit(amount))}>{dollars.format(amount)}</Act>
            ))}
          </div>
        </Row>
        <Row label="Your own buy, filled at once">
          <div className="flex items-center gap-2">
            <Pick<StockSymbol>
              label="Stock"
              value={symbol}
              options={LISTINGS.map((listing) => ({ value: listing.symbol, label: listing.name }))}
              onChange={setSymbol}
            />
            <Act onClick={() => store.act(ownFill(symbol, 250))}>Buy $250</Act>
          </div>
        </Row>
      </Group>

      {agents.length === 0 ?
        (
          <Group title="Agents' trades">
            <p className="text-[12px] text-g-500">This account has no agents yet. Switch to Typical or Heavy user.</p>
          </Group>
        ) :
        (
          <>
            <Group
              title="Approvals"
              hint={`${waiting} ${waiting === 1 ? "trade waits" : "trades wait"} for your Face ID.`}
            >
              {trader === undefined ?
                <p className="text-[12px] text-g-500">No agent here can trade right now.</p> :
                (
                  <>
                    <Pick<string>
                      label="Agent"
                      value={trader.id}
                      options={traders.map((agent) => ({ value: agent.id, label: agent.name }))}
                      onChange={setAgentId}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Act onClick={() => store.act(approval(trader.id, 1))}>One over its limit</Act>
                      <Act onClick={() => store.act(approval(trader.id, 2))}>Plan of 2</Act>
                      <Act onClick={() => store.act(approval(trader.id, 3))}>Plan of 3, two waves</Act>
                      <Act tone="danger" onClick={() => store.act(expireApprovals())}>Expire all</Act>
                    </div>
                  </>
                )}
            </Group>
            <Group title="Agents' trades" hint="A new trade of the agent, in the state you pick.">
              <Pick<string>
                label="Agent"
                value={agents.some((agent) => agent.id === agentId) ? agentId : agents[0]!.id}
                options={agents.map((agent) => ({ value: agent.id, label: `${agent.name} (${agent.state})` }))}
                onChange={setAgentId}
              />
              <Pick<IntentOutcome> label="Outcome" value={outcome} options={OUTCOMES} onChange={setOutcome} />
              <div className="flex flex-wrap gap-2">
                <Act onClick={() => store.act(agentIntent(agentId || agents[0]!.id, outcome))}>Add</Act>
                <Act onClick={() => play((agentId || agents[0]!.id) as AgentId)}>Play sending to filled</Act>
              </div>
            </Group>
          </>
        )}
    </>
  )
}
