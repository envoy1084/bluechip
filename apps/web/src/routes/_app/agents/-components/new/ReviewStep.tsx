import type { Agent } from "@bluechip/domain/agents/Agent"
import { GRANT_DAYS, type Limits } from "@bluechip/domain/agents/Limits"
import { validate } from "@bluechip/domain/agents/Rules"
import type { Template } from "@bluechip/domain/agents/Templates"
import type { RequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { AGENT_TEMPLATES } from "@bluechip/ui/bluechip/template-picker"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { listNames } from "../../../../../agents/limitFields.ts"
import { lockedUntilLabel, uiTemplate } from "../../../../../agents/limits.ts"
import { LimitsRules } from "../../../../../agents/LimitsRules.tsx"
import { useAgentSigning } from "../../../../../agents/useAgentSigning.ts"
import { createAgentAtom, lockAgentAtom } from "../../../../../atoms/agents.ts"
import { TargetMixBar } from "./TargetMixBar.tsx"

const dollars = (amount: bigint) => formatDollars(Number(amount) / 1_000_000)

/** The most it could do on its worst day, from the limits themselves. */
function WorstCase({ limits, nameOf }: Readonly<{ limits: Limits; nameOf: (symbol: StockSymbol) => string }>) {
  const trades = limits.tradesPerDay === 1 ? "one trade" : `${limits.tradesPerDay} trades`

  return (
    <div className="grid justify-items-start gap-1.5 rounded-lg bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] p-[18px] shadow-[var(--shadow-e2),0_0_0_1px_var(--color-info-line)]">
      <span className="mb-1 grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]">
        <Icon name="shield" size={18} />
      </span>
      <b className="text-[15px] font-semibold">The worst case</b>
      <p className="text-body-sm text-g-700">
        On its worst day, this agent could make <b className="text-ink">{trades}</b> of up to{" "}
        <b className="text-ink">{dollars(limits.maxPerTrade)}</b> each
        {limits.dailyBudget > BigInt(0) && (
          <>
            , spending at most <b className="text-ink">{dollars(limits.dailyBudget)}</b> on buys
          </>
        )}, only in {listNames(limits.stocks.map(nameOf))}. It can never move money out of your account.
      </p>
    </div>
  )
}

function Facts({ limits }: Readonly<{ limits: Limits }>) {
  const [until] = useState(() => lockedUntilLabel(new Date(Date.now() + GRANT_DAYS * 24 * 60 * 60 * 1000)))
  const facts = [
    ["Runs for", `${GRANT_DAYS} days, until ${until}`],
    ["Asks you", limits.askAbove > BigInt(0) ? `Before trades over ${dollars(limits.askAbove)}` : "Before every trade"],
    ["You can", "Pause it any time, instantly"]
  ] as const

  return (
    <dl className="grid rounded-lg bg-white px-4 py-0.5 shadow-e2">
      {facts.map(([term, detail]) => (
        <div
          key={term}
          className="flex justify-between gap-3 border-b border-g-100 py-2.5 text-[13.5px] last:border-b-0"
        >
          <dt className="text-g-500">{term}</dt>
          <dd className="text-right font-semibold">{detail}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Step three: the agent as it will be, the worst it could do, and Face ID to lock it. Creating it saves a draft
 * first, so a cancelled Face ID locks that same draft on the next try.
 */
export function ReviewStep(
  { template, name, limits, nameOf, draft, requestId, onDraft, onSent, onEdit, editProblem }: Readonly<{
    template: Template
    name: string
    limits: Limits
    nameOf: (symbol: StockSymbol) => string
    /** The draft saved by an earlier try, if Face ID didn't finish it. */
    draft: Agent | null
    requestId: RequestId
    onDraft: (agent: Agent) => void
    onSent: (agent: Agent) => void
    onEdit: () => void
    /** Why going back to the limits didn't work. */
    editProblem: string | null
  }>
) {
  const create = useAtomSet(createAgentAtom, { mode: "promise" })
  const lock = useAtomSet(lockAgentAtom, { mode: "promise" })
  const { signing, sign } = useAgentSigning()
  const problems = validate(limits, template)
  const spec = AGENT_TEMPLATES.find((candidate) => candidate.name === uiTemplate(template))!

  const prepare = async () => {
    if (draft !== null) {
      return lock({ params: { id: draft.id }, payload: { requestId: crypto.randomUUID() as RequestId } })
    }
    const request = await create({ payload: { requestId, name: name.trim(), template, limits } })
    onDraft(request.agent)
    return request
  }

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        <div className="flex items-center gap-3 px-[18px] py-4">
          <AgentAvatar agentId={draft?.id ?? name} size="lg" />
          <div className="grid min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{name.trim()}</h3>
            <span className="text-label text-g-500">
              {spec.label}, {spec.rule.toLowerCase()}, lasts {GRANT_DAYS} days
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
            <Icon name="edit" size={12} />Draft
          </span>
        </div>

        {template === "rebalancer" && (
          <div className="px-[18px] pb-4">
            <TargetMixBar limits={limits} />
          </div>
        )}

        <LimitsRules
          limits={limits}
          nameOf={nameOf}
          className="rounded-none border-t border-g-100 shadow-none"
          footer={
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Icon name="edit" size={14} />Edit limits
            </Button>
          }
        />
      </div>

      <div className="grid min-w-0 gap-3 lg:sticky lg:top-[76px]">
        <WorstCase limits={limits} nameOf={nameOf} />
        <Facts limits={limits} />

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
        {editProblem !== null && (
          <Alert variant="destructive">
            <AlertDescription>{editProblem}</AlertDescription>
          </Alert>
        )}

        <PasskeyButton
          size="lg"
          disabled={problems.length > 0}
          doneLabel="Sent"
          onAuthenticate={async () => onSent(await sign(prepare))}
          className="w-full"
        >
          Lock these limits with Face ID
        </PasskeyButton>
        <Button variant="ghost" className="w-full" onClick={onEdit}>
          <Icon name="arrow-left" size={16} />Back to limits
        </Button>
      </div>
    </div>
  )
}
