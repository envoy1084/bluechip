import { type Agent, MAX_NAME_LENGTH, SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { describeSpec, policyOf } from "@bluechip/domain/policies/Catalog"
import { formatDollars, listNames } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useId, useState } from "react"
import { createAgentAtom, lockAgentAtom } from "../../atoms/agents.ts"
import { useAgentSigning } from "../../hooks/useAgentSigning.ts"
import { useSpecCheck } from "../../hooks/useSpecCheck.ts"
import { dayLabel } from "../../model/fieldText.ts"
import { type Origin, originLabel, originTemplate } from "../../model/origin.ts"
import { SaveTemplate } from "../SaveTemplate.tsx"
import { PolicyRules } from "../spec/PolicyRules.tsx"
import { TargetMixBar } from "../spec/TargetMixBar.tsx"

/** Whether `name` can be an agent's name: something to call it, short enough for a card. */
const nameProblem = (name: string): string | undefined => {
  const trimmed = name.trim()
  if (trimmed.length === 0) return "Give it a name."
  return trimmed.length > MAX_NAME_LENGTH ? `Keep it to ${MAX_NAME_LENGTH} characters.` : undefined
}

/** The most it could do on its worst day, from its policies. */
function WorstCase({ spec, nameOf }: Readonly<{ spec: AgentSpec; nameOf: (symbol: StockSymbol) => string }>) {
  const count = configOf(spec.policies, tradesPerDay)?.count ?? 0
  const maxPerTrade = configOf(spec.policies, tradeSize)?.maxPerTrade ?? BigInt(0)
  const budget = configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0)
  const stocks = configOf(spec.policies, trade)?.stocks ?? []

  return (
    <div className="grid justify-items-start gap-1.5 rounded-lg bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] p-[18px] shadow-[var(--shadow-e2),0_0_0_1px_var(--color-info-line)]">
      <span className="mb-1 grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]">
        <Icon name="shield" size={18} />
      </span>
      <b className="text-[15px] font-semibold">The worst case</b>
      <p className="text-body-sm text-g-700">
        On its worst day, this agent could make{" "}
        <b className="text-ink">{count === 1 ? "one trade" : `${count} trades`}</b> of up to{" "}
        <b className="text-ink">{formatDollars(maxPerTrade)}</b> each
        {budget > BigInt(0) && (
          <>
            , spending at most <b className="text-ink">{formatDollars(budget)}</b> on buys
          </>
        )}, only in {listNames(stocks.map(nameOf))}. It can never move money out of your account.
      </p>
    </div>
  )
}

function Facts({ spec }: Readonly<{ spec: AgentSpec }>) {
  const [until] = useState(() => dayLabel(new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)))
  const askAbove = configOf(spec.policies, tradeSize)?.maxPerTrade
  const facts = [
    ["Runs for", `${SESSION_DAYS} days, until ${until}`],
    ["Asks you", askAbove === undefined ? "Before every trade" : `Before trades over ${formatDollars(askAbove)}`],
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
 * Step three: the agent as bluechip reads it (`POST /sessions/check`), the worst it could do, its name, and Face ID
 * to lock it. Creating it saves a draft first, so a cancelled Face ID locks that same draft on the next try.
 */
export function ReviewStep(
  { origin, spec, name, onNameChange, nameOf, draft, requestId, onDraft, onSent, onEdit, editProblem }: Readonly<{
    origin: Origin
    spec: AgentSpec
    name: string
    onNameChange: (name: string) => void
    nameOf: (symbol: StockSymbol) => string
    /** The draft saved by an earlier try, if Face ID didn't finish it. */
    draft: Agent | null
    requestId: RequestId
    onDraft: (agent: Agent) => void
    onSent: (agent: Agent) => void
    onEdit: () => void
    /** Why going back to the rules didn't work. */
    editProblem: string | null
  }>
) {
  const nameId = useId()
  const create = useAtomSet(createAgentAtom, { mode: "promise" })
  const lock = useAtomSet(lockAgentAtom, { mode: "promise" })
  const { signing, sign } = useAgentSigning()
  const { checking, retry } = useSpecCheck(spec, null)
  const problem = nameProblem(name)
  const targets = configOf(spec.policies, rebalance)?.targets

  const check = checking.status === "checked" ? checking.check : undefined
  const problems = check?.problems ?? []
  const ready = check !== undefined && problems.length === 0 && problem === undefined

  const prepare = async () => {
    if (draft !== null) {
      return lock({ params: { id: draft.id }, payload: { requestId: crypto.randomUUID() as RequestId } })
    }
    const request = await create({
      payload: { requestId, name: name.trim(), template: originTemplate(origin), spec }
    })
    onDraft(request.agent)
    return request
  }

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-3">
        <div className="overflow-hidden rounded-lg bg-white shadow-e2">
          <div className="flex items-center gap-3 px-[18px] py-4">
            <AgentAvatar agentId={draft?.id ?? name} size="lg" />
            <div className="grid min-w-0 flex-1">
              <h3 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{name.trim() || "Your agent"}</h3>
              <span className="text-label text-g-500">{originLabel(origin)}, lasts {SESSION_DAYS} days</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
              <Icon name="edit" size={12} />Draft
            </span>
          </div>

          {targets === undefined ? null : (
            <div className="px-[18px] pb-4">
              <TargetMixBar targets={targets} />
            </div>
          )}

          <PolicyRules
            description={check?.description ?? describeSpec(spec, nameOf)}
            className="rounded-none border-t border-g-100 shadow-none"
            footer={
              <Button variant="secondary" size="sm" onClick={onEdit}>
                <Icon name="edit" size={14} />Edit rules
              </Button>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-0.5">
          <SaveTemplate spec={spec} basedOn={originTemplate(origin)} defaultName={name.trim() || originLabel(origin)} />
        </div>
      </div>

      <div className="grid min-w-0 gap-3 lg:sticky lg:top-[76px]">
        <WorstCase spec={spec} nameOf={nameOf} />
        <Facts spec={spec} />

        {checking.status === "failed" && (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn't check these rules just now.{" "}
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
        {editProblem !== null && (
          <Alert variant="destructive">
            <AlertDescription>{editProblem}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-1.5">
          <label htmlFor={nameId} className="text-[13.5px] font-semibold">Name</label>
          <Input
            id={nameId}
            value={name}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            disabled={draft !== null}
            aria-invalid={problem === undefined ? undefined : true}
            aria-describedby={`${nameId}-note`}
            onChange={(event) => onNameChange(event.currentTarget.value)}
          />
          <p
            id={`${nameId}-note`}
            className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}
          >
            {problem ??
              (draft === null ? "What you'll call it." : "Saved with its draft. Edit the rules to change it.")}
          </p>
        </div>

        <PasskeyButton
          size="lg"
          disabled={!ready}
          doneLabel="Sent"
          onAuthenticate={async () => onSent(await sign(prepare))}
          className="w-full"
        >
          Lock these rules with Face ID
        </PasskeyButton>
        <Button variant="ghost" className="w-full" onClick={onEdit}>
          <Icon name="arrow-left" size={16} />Back to rules
        </Button>
      </div>
    </div>
  )
}
