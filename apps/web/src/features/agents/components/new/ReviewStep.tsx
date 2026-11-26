import { type Agent, MAX_NAME_LENGTH, SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatDollars, listNames } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { rebalance } from "@bluechip/domain/policies/Rebalance"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { isNoTradeLimit, tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { type ReactNode, useId, useState } from "react"
import { createAgentAtom, lockAgentAtom } from "../../atoms/agents.ts"
import { useAgentSigning } from "../../hooks/useAgentSigning.ts"
import { useSpecCheck } from "../../hooks/useSpecCheck.ts"
import { dayLabel } from "../../model/fieldText.ts"
import { type Origin, originLabel, originTemplate } from "../../model/origin.ts"
import { SaveTemplate } from "../SaveTemplate.tsx"
import { AgentAtAGlance } from "../spec/AgentAtAGlance.tsx"
import { TargetMixBar } from "../spec/TargetMixBar.tsx"
import { StepFoot } from "./NewAgentShell.tsx"

/** Whether `name` can be an agent's name: something to call it, short enough for a card. */
const nameProblem = (name: string): string | undefined => {
  const trimmed = name.trim()
  if (trimmed.length === 0) return "Give it a name."
  return trimmed.length > MAX_NAME_LENGTH ? `Keep it to ${MAX_NAME_LENGTH} characters.` : undefined
}

/**
 * The most it could do on its worst day, from its policies, its money cap first: what it could spend, how big a trade,
 * and how many trades only when that's a limit of its own.
 */
function WorstCase({ spec, nameOf }: Readonly<{ spec: AgentSpec; nameOf: (symbol: StockSymbol) => string }>) {
  const perDay = configOf(spec.policies, tradesPerDay)
  const maxPerTrade = configOf(spec.policies, tradeSize)?.maxPerTrade ?? BigInt(0)
  const budget = configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0)
  const stocks = configOf(spec.policies, trade)?.stocks ?? []
  const count = perDay === undefined || isNoTradeLimit(perDay) ?
    null :
    (
      <>
        , in at most <b>{perDay.count === 1 ? "one trade" : `${perDay.count} trades`}</b>
      </>
    )

  return (
    <WorstCaseCard>
      {budget > BigInt(0) ?
        (
          <>
            On its worst day, this agent could spend at most <b>{formatDollars(budget)}</b> on buys, up to{" "}
            <b>{formatDollars(maxPerTrade)}</b> a trade{count}, only in{" "}
            {listNames(stocks.map(nameOf))}. It can never move money out of your account.
          </>
        ) :
        (
          <>
            On its worst day, this agent could sell up to <b>{formatDollars(maxPerTrade)}</b> a trade{count}, only in
            {" "}
            {listNames(stocks.map(nameOf))}. It never buys, and it can never move money out of your account.
          </>
        )}
    </WorstCaseCard>
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
    <OrderPreview>
      {facts.map(([term, detail]) => <OrderPreviewRow key={term} label={term}>{detail}</OrderPreviewRow>)}
    </OrderPreview>
  )
}

/**
 * Step three: its name, the agent as bluechip reads it (`POST /sessions/check`), the automations it comes with, the
 * worst it could do, and Face ID to lock it. Creating it saves a draft first, so a cancelled Face ID locks that same draft on the next try.
 */
export function ReviewStep(
  {
    origin,
    spec,
    name,
    onNameChange,
    nameOf,
    draft,
    requestId,
    onDraft,
    onSent,
    onEdit,
    editProblem,
    automations
  }: Readonly<{
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
    /** The automations its template comes with. */
    automations: ReactNode
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
          <div className="grid gap-1.5 px-[18px] py-4">
            <label htmlFor={nameId} className="text-label-sm font-semibold text-g-500">Name</label>
            <div className="flex items-center gap-3">
              <AgentAvatar agentId={draft?.id ?? name} size="lg" />
              <Input
                id={nameId}
                value={name}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="off"
                disabled={draft !== null}
                aria-invalid={problem === undefined ? undefined : true}
                aria-describedby={`${nameId}-note`}
                onChange={(event) => onNameChange(event.currentTarget.value)}
                className="min-w-0 flex-1 text-[16px] font-semibold"
              />
            </div>
            <p
              id={`${nameId}-note`}
              className={cn("text-label-sm text-g-500", problem !== undefined && "font-medium text-loss")}
            >
              {problem ??
                (draft === null ?
                  `${originLabel(origin)}, runs for ${SESSION_DAYS} days once locked.` :
                  "Saved with its draft. Edit the rules to change it.")}
            </p>
          </div>

          {targets === undefined ? null : (
            <div className="px-[18px] pb-4">
              <TargetMixBar targets={targets} />
            </div>
          )}
        </div>

        <AgentAtAGlance spec={spec} nameOf={nameOf} />

        {automations}

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
      </div>

      <StepFoot className="lg:col-span-2">
        <Button variant="ghost" onClick={onEdit}>
          <Icon name="arrow-left" size={16} />Back to rules
        </Button>
        <PasskeyButton disabled={!ready} doneLabel="Sent" onAuthenticate={async () => onSent(await sign(prepare))}>
          Lock these rules with Face ID
        </PasskeyButton>
      </StepFoot>
    </div>
  )
}
