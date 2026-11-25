import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { compareSpecs, policyOf } from "@bluechip/domain/policies/Catalog"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { changeAgentAtom } from "../../atoms/agents.ts"
import { useAgentSigning } from "../../hooks/useAgentSigning.ts"
import { useSpecCheck } from "../../hooks/useSpecCheck.ts"
import { PolicyRules } from "../spec/PolicyRules.tsx"
import { SpecChangeRows } from "../spec/SpecChangeRows.tsx"

/**
 * The change as bluechip reads it (`POST /sessions/check` against the rules in force): each policy that moves, what
 * its values were and become, whether that's tighter or looser, and what the agent could do after. Every change is
 * a new session locked onchain, so all of them take Face ID.
 */
export function ChangeReview(
  { agent, spec, nameOf, onBack, onSent }: Readonly<{
    agent: Agent
    spec: AgentSpec
    nameOf: (symbol: StockSymbol) => string
    onBack: () => void
    onSent: (agent: Agent) => void
  }>
) {
  const change = useAtomSet(changeAgentAtom, { mode: "promise" })
  const { signing, sign } = useAgentSigning()
  const { checking, retry } = useSpecCheck(spec, agent.spec)

  const check = checking.status === "checked" ? checking.check : undefined
  const changes = check?.changes ?? compareSpecs(agent.spec, spec)
  const shown = changes.policies.filter((moved) => !policyOf(moved.policy).hidden)
  const looser = shown.filter((moved) => moved.change === "looser" || moved.change === "removed").length
  const problems = check?.problems ?? []

  return (
    <div className="mx-auto grid w-full max-w-[640px] gap-3">
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        <div className="flex items-start justify-between gap-3 border-b border-g-100 px-[18px] py-4">
          <div className="grid">
            <h3 className="text-[17px] font-semibold tracking-[-0.015em]">Edit rules</h3>
            <span className="text-label-sm text-g-500">
              {shown.length - looser} tighter, {looser} looser
            </span>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Back to the rules" onClick={onBack}>
            <Icon name="close" size={16} />
          </Button>
        </div>

        <SpecChangeRows before={agent.spec} after={spec} changes={changes} nameOf={nameOf} />

        <p className="flex items-start gap-1.5 border-t border-g-100 bg-[#fafafb] px-[18px] py-3.5 text-label text-g-600">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          {changes.overall === "looser" ?
            `Overall this gives ${agent.name} more room. Every change is locked on Base with Face ID and applies once it lands.` :
            "Overall this only narrows what it can do. Every change is locked on Base with Face ID and applies once it lands."}
        </p>
      </div>

      {check === undefined ? null : (
        <div className="grid gap-2">
          <span className="px-0.5 text-caption font-semibold tracking-[.06em] text-g-500 uppercase">
            What it could do after
          </span>
          <PolicyRules description={check.description} />
        </div>
      )}

      {checking.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>
            We couldn't check this change just now.{" "}
            <button type="button" className="font-semibold underline" onClick={retry}>Try again</button>
          </AlertDescription>
        </Alert>
      )}
      {problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>These rules can't be locked yet</AlertTitle>
          <AlertDescription>
            <ul className="grid gap-1">
              {problems.map((found) => (
                <li key={`${found.policy}-${found.field}-${found.message}`}>
                  {policyOf(found.policy).title}: {found.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {signing.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>{signing.message}</AlertDescription>
        </Alert>
      )}

      <PasskeyButton
        size="lg"
        disabled={check === undefined || problems.length > 0 || shown.length === 0}
        doneLabel="Sent"
        onAuthenticate={async () =>
          onSent(
            await sign(() =>
              change({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId, spec } })
            )
          )}
        className="w-full"
      >
        Lock new rules with Face ID
      </PasskeyButton>
      <Button variant="ghost" className="w-full" onClick={onBack}>
        <Icon name="arrow-left" size={16} />Back to rules
      </Button>
    </div>
  )
}
