import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useNavigate } from "@tanstack/react-router"
import { SectionHeader } from "../../../../components/layout/SectionHeader.tsx"
import { dayLabel } from "../../model/fieldText.ts"
import { SaveTemplate } from "../SaveTemplate.tsx"
import { AgentAtAGlance } from "../spec/AgentAtAGlance.tsx"
import { SpecChangeRows } from "../spec/SpecChangeRows.tsx"
import { TargetMixBar } from "../spec/TargetMixBar.tsx"
import { RenewButton } from "./RenewButton.tsx"

/**
 * The rules in force (or, for a draft, the ones it will lock) in words, with Edit and Renew while it's active (Renew
 * once it ran out), and a
 * change on its way to Base.
 */
export function PoliciesSection(
  { agent, nameOf }: Readonly<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>
) {
  const navigate = useNavigate()
  const removed = agent.status === "removed"
  const active = agent.status === "active"
  const expired = agent.status === "expired"
  const lockedUntil = agent.lockedUntil === null || removed
    ? undefined
    : dayLabel(agent.lockedUntil)
  const targets = configOf(agent.spec.policies, rebalance)?.targets
  const pending = agent.pendingSpec === null ? null : compareSpecs(agent.spec, agent.pendingSpec)

  return (
    <section aria-labelledby={`rules-${agent.id}`} className="grid content-start gap-3">
      <SectionHeader
        id={`rules-${agent.id}`}
        level="h3"
        title={removed ? "The rules it had" : agent.status === "draft" ? "The rules it will lock" : "Its rules"}
        description="What it can and can never do, checked onchain before every trade."
      />
      {targets === undefined ? null : (
        <div className="rounded-lg bg-white px-[18px] py-4 shadow-e2">
          <TargetMixBar targets={targets} />
        </div>
      )}
      <AgentAtAGlance
        spec={agent.spec}
        nameOf={nameOf}
        lockedLine={removed ?
          "Removed, so these rules no longer apply" :
          expired ?
          `Ran out${lockedUntil === undefined ? "" : ` on ${lockedUntil}`}. Renew it to keep these rules` :
          lockedUntil === undefined ?
          "Not locked yet" :
          `Locked with Face ID until ${lockedUntil}`}
        action={active ?
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
          expired ?
          <RenewButton agent={agent} variant="primary" /> :
          undefined}
      />
      {removed ? null : (
        <div className="px-0.5">
          <SaveTemplate spec={agent.spec} basedOn={agent.template} defaultName={`${agent.name}'s rules`.slice(0, 40)} />
        </div>
      )}

      {agent.status === "updating" && agent.pendingSpec !== null && pending !== null && pending.policies.length > 0 ?
        (
          <>
            <SectionHeader
              id={`rules-change-${agent.id}`}
              level="h3"
              title="The change on its way"
              description="Its new rules take force once Base has them."
            />
            <div className="overflow-hidden rounded-lg bg-white shadow-e2">
              <SpecChangeRows before={agent.spec} after={agent.pendingSpec} changes={pending} nameOf={nameOf} />
            </div>
          </>
        ) :
        null}
    </section>
  )
}
