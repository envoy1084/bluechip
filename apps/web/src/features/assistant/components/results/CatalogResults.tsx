import type { Memory } from "@bluechip/domain/assistant/Memory"
import type { RecallHit } from "@bluechip/domain/assistant/Recall"
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { Passage } from "@bluechip/domain/knowledge/Knowledge"
import type { AutomationPerformance } from "@bluechip/domain/performance/Performance"
import type { PolicyInfo } from "@bluechip/domain/policies/Catalog"
import type { SavedTemplate, TemplateInfo } from "@bluechip/domain/policies/Templates"
import { ChatResultRow, ChatResultRows, ChatResultStat, ChatResultStats } from "@bluechip/ui/bluechip/chat-result"
import { OutcomeLink } from "@bluechip/ui/bluechip/outcome"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDate, formatMoney } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { StandingPill } from "../../../../components/StandingPill.tsx"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { RUN_RESULT, standingOf } from "../../../../lib/automationWords.ts"
import { localTimeZone } from "../../../../lib/localTime.ts"
import type { ResultState } from "../../model/resultCards.ts"
import { RESULT_LOOK } from "../../model/resultText.ts"
import { LookedResult } from "./MoneyResults.tsx"
import { more, OpenLink } from "./OpenLink.tsx"

const SHOWN = 4

// A section heading inside a line, "Approvals: when you're asked"; an acronym ("USDC on Base") keeps its capitals.
const sectionText = (section: string): string =>
  /^\p{Lu}\p{Lu}/u.test(section) ? section : `${section.charAt(0).toLowerCase()}${section.slice(1)}`

const day = (at: DateTime.Utc) => formatDate(DateTime.toDateUtc(at), { timeZone: localTimeZone(), time: false })

/** Your automations as compact rows: what each does in a sentence, and whether it's on. */
export function AutomationsResult(
  { automations, state }: Readonly<{ automations: ReadonlyArray<Automation>; state: ResultState }>
) {
  const shown = automations.slice(0, SHOWN)
  return (
    <LookedResult
      look={RESULT_LOOK.listAutomations}
      state={state}
      action={<OpenLink label="See all" to="/automations" />}
      {...more(automations.length - shown.length)}
    >
      <ChatResultRows>
        {shown.map((automation) => (
          <ChatResultRow
            key={automation.id}
            media={<Icon name="zap" size={16} className="text-g-500" />}
            title={automation.name}
            detail={automation.description.sentence}
            valueDetail={<StandingPill standing={standingOf(automation, [])} />}
          />
        ))}
      </ChatResultRows>
    </LookedResult>
  )
}

/** How one automation's runs ended and what its trades moved. */
export function AutomationPerformanceResult(
  { performance, state }: Readonly<{ performance: AutomationPerformance; state: ResultState }>
) {
  const outcomes = performance.outcomes.filter((row) => row.count > 0).map((row) =>
    `${row.count} ${RUN_RESULT[row.result].word}`
  )
  return (
    <LookedResult
      look={RESULT_LOOK.getAutomationPerformance}
      state={state}
      action={<OpenLink to="/automations/$automationId" params={{ automationId: performance.automationId }} />}
    >
      <ChatResultStats>
        <ChatResultStat label="Runs" value={performance.runs} />
        <ChatResultStat label="Trades" value={performance.trades} />
        <ChatResultStat label="Bought" value={formatMoney(usdcDollars(performance.bought))} />
      </ChatResultStats>
      <p className="text-label-sm text-g-500">
        {[
          ...(outcomes.length === 0 ? [] : [`Runs: ${outcomes.join(", ")}.`]),
          ...(performance.lastRunAt === null ? [] : [`Last ran ${day(performance.lastRunAt)}.`])
        ].join(" ")}
      </p>
    </LookedResult>
  )
}

/** The templates an agent starts from, bluechip's and yours. */
export function TemplatesResult(
  { builtIn, saved }: Readonly<{ builtIn: ReadonlyArray<TemplateInfo>; saved: ReadonlyArray<SavedTemplate> }>
) {
  const rows = [
    ...saved.map((template) => ({ id: template.id, title: template.name, detail: "Yours" })),
    ...builtIn.map((template) => ({ id: template.id, title: template.title, detail: template.summary }))
  ]
  const shown = rows.slice(0, SHOWN)
  return (
    <LookedResult
      look={RESULT_LOOK.listTemplates}
      state="ready"
      action={<OpenLink label="Start an agent" to="/agents/new" />}
      {...more(rows.length - shown.length)}
    >
      <ChatResultRows>
        {shown.map((row) => (
          <ChatResultRow
            key={row.id}
            media={<Icon name="layers" size={16} className="text-g-500" />}
            title={row.title}
            detail={row.detail}
          />
        ))}
      </ChatResultRows>
    </LookedResult>
  )
}

/** The policies an agent can carry, each in a line. */
export function PoliciesResult({ policies }: Readonly<{ policies: ReadonlyArray<PolicyInfo> }>) {
  const visible = policies.filter((policy) => !policy.hidden)
  const shown = visible.slice(0, SHOWN + 1)
  return (
    <LookedResult look={RESULT_LOOK.listPolicies} state="ready" {...more(visible.length - shown.length)}>
      <ChatResultRows>
        {shown.map((policy) => (
          <ChatResultRow
            key={policy.id}
            media={<Icon name="shield" size={16} className="text-g-500" />}
            title={policy.title}
            detail={policy.summary}
            {...(policy.required ? { valueDetail: "Every agent" } : {})}
          />
        ))}
      </ChatResultRows>
    </LookedResult>
  )
}

const RECALLED: Readonly<Record<RecallHit["kind"], string>> = {
  memory: "A memory",
  message: "An earlier message",
  summary: "An earlier chat",
  journal: "An agent's journal"
}

/** What it remembers, or what a search of before found: each in your words, with where it came from. */
export function MemoriesResult(
  { found, search, state }: Readonly<
    { found: ReadonlyArray<Memory | RecallHit>; search: boolean; state: ResultState }
  >
) {
  const shown = found.slice(0, SHOWN)
  return (
    <LookedResult
      look={search ? RESULT_LOOK.searchMemory : RESULT_LOOK.listMemories}
      state={state}
      action={<OpenLink label="See all" to="/memory" />}
      {...more(found.length - shown.length)}
    >
      <ChatResultRows>
        {shown.map((entry) => (
          <ChatResultRow
            key={"id" in entry ? entry.id : `${entry.kind}:${entry.sourceId}`}
            media={<Icon name="book" size={16} className="text-g-500" />}
            title={entry.text}
            wrap
            detail={"id" in entry ?
              entry.confirmedAt === null ? "Waiting for you to confirm" : `Since ${day(entry.createdAt)}` :
              `${RECALLED[entry.kind]}, ${day(entry.at)}`}
          />
        ))}
      </ChatResultRows>
    </LookedResult>
  )
}

/** The help article that answers it: its title and section, the passage, and the way to read more. */
export function HelpResult({ passages, state }: Readonly<{ passages: ReadonlyArray<Passage>; state: ResultState }>) {
  const [best, ...others] = passages
  return (
    <LookedResult look={RESULT_LOOK.searchHelp} state={state}>
      {best === undefined ? null : (
        <div className="grid gap-1.5">
          <b className="text-[14px] font-semibold">
            {best.citation.title}
            {best.citation.section === null ?
              null :
              <span className="font-normal text-g-500">{`: ${sectionText(best.citation.section)}`}</span>}
          </b>
          <p className="line-clamp-3 text-label text-g-700">{best.text}</p>
          <OutcomeLink href={best.citation.url} className="justify-self-start">Read more</OutcomeLink>
        </div>
      )}
      {others.length === 0 ? null : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-g-100 pt-2">
          {others.slice(0, 3).map((passage) => (
            <li key={`${passage.citation.url}:${passage.citation.section ?? ""}`}>
              <OutcomeLink href={passage.citation.url}>
                {passage.citation.section === null ?
                  passage.citation.title :
                  `${passage.citation.title}: ${sectionText(passage.citation.section)}`}
              </OutcomeLink>
            </li>
          ))}
        </ul>
      )}
    </LookedResult>
  )
}
