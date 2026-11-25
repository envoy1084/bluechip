import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { compareSpecs, describeSpec } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { dayLabel } from "../../model/fieldText.ts"
import { SaveTemplate } from "../SaveTemplate.tsx"
import { PolicyRules } from "../spec/PolicyRules.tsx"
import { SpecChangeRows } from "../spec/SpecChangeRows.tsx"
import { TargetMixBar } from "../spec/TargetMixBar.tsx"
import { RenewButton } from "./RenewButton.tsx"

function Heading({ children }: Readonly<{ children: string }>) {
  return <h3 className="px-0.5 text-label-sm font-semibold text-g-500">{children}</h3>
}

/**
 * The rules in force (or, for a draft, the ones it will lock) in words, with Edit and Renew while it's active, and a
 * change on its way to Base.
 */
export function PoliciesSection(
  { agent, nameOf }: Readonly<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>
) {
  const navigate = useNavigate()
  const removed = agent.status === "removed"
  const active = agent.status === "active"
  const lockedUntil = agent.lockedUntil === null || removed
    ? undefined
    : dayLabel(DateTime.toDateUtc(agent.lockedUntil))
  const targets = configOf(agent.spec.policies, rebalance)?.targets
  const pending = agent.pendingSpec === null ? null : compareSpecs(agent.spec, agent.pendingSpec)

  return (
    <section className="grid content-start gap-2.5">
      <Heading>
        {removed ? "The rules it had" : agent.status === "draft" ? "The rules it will lock" : "Its rules"}
      </Heading>
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        {targets === undefined ? null : (
          <div className="px-[18px] pt-4 pb-1">
            <TargetMixBar targets={targets} />
          </div>
        )}
        <PolicyRules
          description={describeSpec(agent.spec, nameOf)}
          lockedUntil={lockedUntil}
          lockLine={removed ? "Removed, so these rules no longer apply" : undefined}
          className="rounded-none shadow-none"
          footer={active ?
            (
              <span className="flex flex-wrap items-start gap-2">
                <RenewButton agent={agent} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigate({ to: "/agents/$agentId/edit", params: { agentId: agent.id } })}
                >
                  <Icon name="edit" size={14} />Edit rules
                </Button>
              </span>
            ) :
            undefined}
        />
      </div>
      {removed ? null : (
        <div className="px-0.5">
          <SaveTemplate spec={agent.spec} basedOn={agent.template} defaultName={`${agent.name}'s rules`.slice(0, 40)} />
        </div>
      )}

      {agent.status === "updating" && agent.pendingSpec !== null && pending !== null && pending.policies.length > 0 ?
        (
          <>
            <Heading>The change on its way</Heading>
            <div className="overflow-hidden rounded-lg bg-white shadow-e2">
              <SpecChangeRows before={agent.spec} after={agent.pendingSpec} changes={pending} nameOf={nameOf} />
            </div>
          </>
        ) :
        null}
    </section>
  )
}
