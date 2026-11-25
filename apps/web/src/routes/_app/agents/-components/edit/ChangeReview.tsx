import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Limits } from "@bluechip/domain/agents/Limits"
import { compare, LimitField, validate } from "@bluechip/domain/agents/Rules"
import type { RequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { formatLimitField, LIMIT_LABELS } from "../../../../../agents/limitFields.ts"
import { useAgentSigning } from "../../../../../agents/useAgentSigning.ts"
import { changeLimitsAtom } from "../../../../../atoms/agents.ts"

/**
 * The change, field by field: what each limit was, what it becomes, and whether that's tighter or looser. Every
 * change is locked onchain, so all of them take Face ID.
 */
export function ChangeReview(
  { agent, limits, nameOf, onBack, onSent }: Readonly<{
    agent: Agent
    limits: Limits
    nameOf: (symbol: StockSymbol) => string
    onBack: () => void
    onSent: (agent: Agent) => void
  }>
) {
  const changeLimits = useAtomSet(changeLimitsAtom, { mode: "promise" })
  const { signing, sign } = useAgentSigning()

  const { fields } = compare(agent.limits, limits)
  const changed = LimitField.literals.filter((field) => fields[field] !== "same")
  const looser = changed.filter((field) => fields[field] === "looser").length
  const problems = validate(limits, agent.template)

  return (
    <div className="mx-auto grid w-full max-w-[640px] gap-3">
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        <div className="flex items-start justify-between gap-3 border-b border-g-100 px-[18px] py-4">
          <div className="grid">
            <h3 className="text-[17px] font-semibold tracking-[-0.015em]">Edit limits</h3>
            <span className="text-label-sm text-g-500">
              {changed.length - looser} tighter, {looser} looser
            </span>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Back to the limits" onClick={onBack}>
            <Icon name="close" size={16} />
          </Button>
        </div>

        <ul className="grid">
          {changed.map((field) => (
            <li
              key={field}
              className="grid gap-x-3 gap-y-1 border-b border-g-100 px-[18px] py-3 text-[13.5px] sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="font-semibold">{LIMIT_LABELS[field]}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5 tabular-nums">
                <s className="text-g-500">{formatLimitField(field, agent.limits, nameOf)}</s>
                <Icon name="arrow-right" size={14} className="text-g-400" />
                <b className="font-semibold">{formatLimitField(field, limits, nameOf)}</b>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 justify-self-start rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap",
                  fields[field] === "tighter" ?
                    "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]" :
                    "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
                )}
              >
                <Icon name={fields[field] === "tighter" ? "shield" : "unlock"} size={12} />
                {fields[field] === "tighter" ? "Tighter" : "Looser"}
              </span>
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-1.5 bg-[#fafafb] px-[18px] py-3.5 text-label text-g-600">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          {looser > 0 ?
            `Looser limits give ${agent.name} more room. Every change is locked on Base with Face ID and applies once it lands.` :
            `Every change is locked on Base with Face ID and applies once it lands.`}
        </p>
      </div>

      {problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>These limits can't be locked yet</AlertTitle>
          <AlertDescription>{problems.map((problem) => problem.message).join(" ")}</AlertDescription>
        </Alert>
      )}
      {signing.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>{signing.message}</AlertDescription>
        </Alert>
      )}

      <PasskeyButton
        size="lg"
        disabled={problems.length > 0 || changed.length === 0}
        doneLabel="Sent"
        onAuthenticate={async () =>
          onSent(
            await sign(() =>
              changeLimits({
                params: { id: agent.id },
                payload: { requestId: crypto.randomUUID() as RequestId, limits }
              })
            )
          )}
        className="w-full"
      >
        Lock new limits with Face ID
      </PasskeyButton>
      <Button variant="ghost" className="w-full" onClick={onBack}>
        <Icon name="arrow-left" size={16} />Back to limits
      </Button>
    </div>
  )
}
