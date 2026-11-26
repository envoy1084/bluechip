import type { AutomationDetail } from "@bluechip/domain/automations/Run"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import type { AutomationId, IntentId } from "@bluechip/domain/Ids"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@bluechip/ui/components/alert-dialog"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDate, formatRelative } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ComponentType, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { localTimeZone } from "../../../lib/localTime.ts"
import { automationAtom, changedKeys, removeAutomationAtom, updateAutomationAtom } from "../atoms/automations.ts"
import { RunCard } from "../components/detail/RunCard.tsx"
import { AutomationNotFound, ScreenState } from "../components/ScreenState.tsx"
import { StatusPill } from "../components/StatusPill.tsx"
import { CREATED_BY, firesText, saveProblem, STATUS } from "../model/automationText.ts"
import { traderName } from "../model/traders.ts"

type IntentView = ComponentType<{ id: IntentId }>

/**
 * One automation: what it does in a sentence, who trades, how often it ran, Pause, Edit and Delete, then its runs.
 * `Intent` draws each trade a run proposed; it comes from the intents feature, through the route.
 */
export function AutomationScreen({ id, Intent }: Readonly<{ id: AutomationId; Intent: IntentView }>) {
  const detail = useAtomValue(automationAtom(id))
  const refresh = useAtomRefresh(automationAtom(id))

  if (AsyncResult.isSuccess(detail)) return <AutomationContent detail={detail.value} Intent={Intent} />
  if (Option.getOrUndefined(AsyncResult.error(detail)) instanceof NotFoundError) return <AutomationNotFound />
  return (
    <ScreenState title="Automation" what="this automation" failed={AsyncResult.isFailure(detail)} onRetry={refresh} />
  )
}

function AutomationContent({ detail, Intent }: Readonly<{ detail: AutomationDetail; Intent: IntentView }>) {
  const { automation, runs, judgments } = detail
  const agents = useAtomValue(agentsAtom)
  const update = useAtomSet(updateAutomationAtom, { mode: "promise" })
  const remove = useAtomSet(removeAutomationAtom, { mode: "promise" })
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [now] = useState(() => new Date())
  const zone = localTimeZone()

  const agent = AsyncResult.isSuccess(agents) ?
    agents.value.find((candidate) => candidate.id === automation.agentId) ?? null :
    null
  const status = STATUS[automation.status]
  const ended = automation.status === "done" || automation.status === "expired"

  const act = async (change: () => Promise<unknown>) => {
    setBusy(true)
    setProblem(null)
    try {
      await change()
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setBusy(false)
    }
  }
  const setStatus = (next: "active" | "paused") =>
    act(() => update({ params: { id: automation.id }, payload: { status: next }, reactivityKeys: changedKeys }))
  const deleteIt = () =>
    act(async () => {
      await remove({ params: { id: automation.id }, reactivityKeys: changedKeys })
      await navigate({ to: "/automations" })
    })

  return (
    <AppPage
      title={automation.name}
      sub={
        <>
          <Link to="/automations" className="hover:text-ink">Automations</Link> / {automation.name}
        </>
      }
      actions={ended ? undefined : (
        <ButtonLink
          variant="secondary"
          size="sm"
          render={<Link to="/automations/$automationId/edit" params={{ automationId: automation.id }} />}
        >
          <Icon name="edit" size={14} />Edit
        </ButtonLink>
      )}
      width="wide"
    >
      <section aria-label="What it does" className="grid gap-4 rounded-lg bg-white p-5 shadow-e2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 flex-[1_1_300px] gap-1.5">
            <StatusPill label={status.label} tone={status.tone} className="justify-self-start" />
            <p className="text-[17px] leading-snug font-semibold tracking-[-0.015em] text-ink">
              {automation.description.sentence}
            </p>
            <span className="text-label text-g-500">
              {automation.agentId === null ?
                traderName(null) :
                agent === null ?
                "Through an agent that's gone" :
                (
                  <>
                    Through{" "}
                    <Link to="/agents/$agentId" params={{ agentId: agent.id }} className="font-medium text-blue">
                      {agent.name}
                    </Link>, inside its rules
                  </>
                )}
            </span>
          </div>
          {ended ? null : (
            <div className="flex flex-wrap items-center gap-2">
              {automation.status === "paused" ?
                (
                  <Button size="sm" loading={busy} onClick={() => void setStatus("active")}>
                    <Icon name="play" size={14} />Resume
                  </Button>
                ) :
                (
                  <Button variant="secondary" size="sm" loading={busy} onClick={() => void setStatus("paused")}>
                    <Icon name="pause" size={14} />Pause
                  </Button>
                )}
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="ghost" size="sm" className="text-loss hover:bg-loss-wash hover:text-loss" />}
                >
                  <Icon name="trash" size={14} />Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogIcon name="trash" />
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{automation.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It stops at once and won't run again. Trades it already proposed stay as they are.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void deleteIt()}>Delete automation</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {problem === null ? null : (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}

        <StatGrid className="border-t border-g-100 pt-4">
          <StatTile label="Ran" value={firesText(automation.fires)} />
          <StatTile
            label="Last ran"
            value={automation.lastFiredAt === null ?
              "Never" :
              formatRelative(DateTime.toDateUtc(automation.lastFiredAt), now, { timeZone: zone })}
          />
          {automation.nextRunAt === null || automation.status !== "active" ? null : (
            <StatTile
              label="Next run"
              value={formatDate(DateTime.toDateUtc(automation.nextRunAt), { timeZone: zone })}
            />
          )}
          <StatTile
            label="Set up"
            value={formatDate(DateTime.toDateUtc(automation.createdAt), { timeZone: zone, time: false })}
            detail={CREATED_BY[automation.createdBy]}
          />
        </StatGrid>

        {automation.description.settings.length === 0 ?
          null :
          (
            <ul aria-label="Settings" className="flex flex-wrap gap-1.5">
              {automation.description.settings.map((setting) => (
                <li key={setting} className="rounded-full bg-g-50 px-2.5 py-1 text-label-sm text-g-700">{setting}</li>
              ))}
            </ul>
          )}
      </section>

      <section aria-labelledby="runs" className="grid gap-2.5">
        <h2 id="runs" className="px-0.5 text-label-sm font-semibold text-g-500">Runs</h2>
        {runs.length === 0 ?
          (
            <p className="rounded-lg bg-white px-[18px] py-4 text-label text-g-600 shadow-e2">
              No runs yet. It runs {automation.description.trigger}.
            </p>
          ) :
          (
            <ul className="rounded-lg bg-white shadow-e2">
              {runs.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  judgments={judgments.filter((judgment) => judgment.runId === run.id)}
                  Intent={Intent}
                />
              ))}
            </ul>
          )}
      </section>
    </AppPage>
  )
}
