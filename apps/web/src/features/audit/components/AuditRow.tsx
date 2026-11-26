import type { AuditEvent } from "@bluechip/domain/audit/Audit"
import { AccountAvatar, AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { LogoMark } from "@bluechip/ui/bluechip/logo"
import { TableCell } from "@bluechip/ui/components/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@bluechip/ui/components/tooltip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { useState } from "react"
import { auditData, auditExactTime, auditRecord, auditWhen } from "../model/auditDetails.ts"
import {
  actorLabel,
  AUDIT_TYPES,
  type AuditSubject,
  auditSubject,
  type AuditTone,
  auditTone,
  auditTypeOf,
  describeAudit
} from "../model/auditText.ts"

const TONE: Readonly<Record<AuditTone, string>> = {
  gain: "bg-gain-wash text-gain",
  loss: "bg-loss-wash text-loss",
  warn: "bg-warn-wash text-warn",
  plain: "bg-g-100 text-g-600"
}

const ACTOR_ICON: Readonly<Record<"assistant" | "automation", IconName>> = { assistant: "chat", automation: "zap" }

const avatarClassName = "size-5 rounded-full [&_canvas]:w-3.5"

/** Who acted: you, an agent with its butterfly, the assistant, an automation, or bluechip. */
function Who({ event, name }: Readonly<{ event: AuditEvent; name: string }>) {
  const agentId = event.actorId ?? event.agentId
  const avatar = () => {
    switch (event.actor) {
      case "owner":
        return <AccountAvatar size="sm" label="" aria-hidden className={avatarClassName} />
      case "agent":
        return agentId === null ? null : <AgentAvatar agentId={agentId} size="sm" className={avatarClassName} />
      case "system":
        return (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white shadow-e1">
            <LogoMark size={12} aria-hidden />
          </span>
        )
      case "assistant":
      case "automation":
        return (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-blue-50 text-blue">
            <Icon name={ACTOR_ICON[event.actor]} size={12} />
          </span>
        )
    }
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      {avatar()}
      <span className="truncate font-[550] text-g-700">{name}</span>
    </span>
  )
}

/** A link to what an entry was about: its agent, trade, automation, security setting or chats. */
function SubjectLink({ subject, className }: Readonly<{ subject: AuditSubject; className?: string }>) {
  const linkClassName = cn(
    "relative z-1 inline-flex max-w-full items-center gap-1 truncate rounded-[5px] text-g-700 underline-offset-4 hover:text-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
    className
  )
  const label = <span className="truncate">{subject.label}</span>

  switch (subject._tag) {
    case "Agent":
      return <Link to="/agents/$agentId" params={{ agentId: subject.agentId }} className={linkClassName}>{label}</Link>
    case "Trade":
      return subject.agentId === null ?
        <Link to="/activity" className={linkClassName}>{label}</Link> :
        (
          <Link to="/agents/$agentId/history" params={{ agentId: subject.agentId }} className={linkClassName}>
            {label}
          </Link>
        )
    case "Automation":
      return (
        <Link to="/automations/$automationId" params={{ automationId: subject.automationId }} className={linkClassName}>
          {label}
        </Link>
      )
    case "Security":
      return <Link to="/settings/security" className={linkClassName}>{label}</Link>
    case "Chats":
      return <Link to="/settings/notifications" className={linkClassName}>{label}</Link>
  }
}

/**
 * One entry of the log as a table row: when, who, what happened with its kind's icon, and what it was about; the
 * row opens its record (every field, and its data as JSON). Narrow screens keep the sentence and fold the rest under
 * it.
 */
export function AuditRow(
  { event, agentName, now, timeZone }: Readonly<{
    event: AuditEvent
    agentName: (id: string) => string | undefined
    now: Date
    timeZone: string
  }>
) {
  const [open, setOpen] = useState(false)
  const type = AUDIT_TYPES.find((option) => option.value === auditTypeOf(event))
  const subject = auditSubject(event, agentName)
  const who = actorLabel(event, agentName)
  const when = auditWhen(event.at, now, timeZone)
  const exact = auditExactTime(event.at, timeZone)
  const data = auditData(event)
  const detailsId = `audit-details-${event.id}`

  return (
    <>
      <tr
        data-testid="audit-event"
        data-open={open ? "" : undefined}
        className="group relative transition-colors duration-fast ease-brand hover:bg-g-50 data-open:bg-g-50"
      >
        <TableCell className="w-[104px] border-b border-g-100 py-2.5 pr-2 pl-4 align-middle whitespace-nowrap text-g-500 tabular-nums max-md:hidden">
          <Tooltip>
            <TooltipTrigger
              render={<time dateTime={DateTime.formatIso(event.at)} className="relative z-1 cursor-default" />}
            >
              {when}
            </TooltipTrigger>
            <TooltipContent>{exact}</TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="w-[170px] max-w-[170px] border-b border-g-100 px-2 py-2.5 align-middle max-md:hidden">
          <Who event={event} name={who} />
        </TableCell>
        <TableCell className="border-b border-g-100 py-2.5 pr-2 pl-4 align-middle whitespace-normal md:pl-2">
          <span className="flex min-w-0 items-center gap-3">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-[8px]", TONE[auditTone(event)])}>
              <Icon name={type?.icon ?? "activity"} size={15} />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="text-[13.5px] leading-snug font-[550] text-ink">{describeAudit(event)}</span>
              <span className="truncate text-label-sm text-g-500 md:hidden">{who}, {when}</span>
            </span>
          </span>
        </TableCell>
        <TableCell className="w-[190px] max-w-[190px] border-b border-g-100 px-2 py-2.5 align-middle text-label max-md:hidden">
          {subject === undefined ? <span className="text-g-400">None</span> : <SubjectLink subject={subject} />}
        </TableCell>
        <TableCell className="w-11 border-b border-g-100 py-2.5 pr-3 pl-1 text-right align-middle">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={`Details: ${describeAudit(event)}`}
            onClick={() => setOpen(!open)}
            className="inline-grid size-7 cursor-pointer place-items-center rounded-[7px] text-g-400 transition-colors duration-fast ease-brand group-hover:text-g-600 hover:bg-g-100 focus-visible:outline-2 focus-visible:outline-blue after:absolute after:inset-0 after:content-['']"
          >
            <Icon
              name="chevron-down"
              size={16}
              className={cn("transition-transform duration-base ease-brand", open && "rotate-180")}
            />
          </button>
        </TableCell>
      </tr>
      {open ?
        (
          <tr id={detailsId} className="bg-g-50">
            <TableCell colSpan={5} className="border-b border-g-100 px-4 pt-1 pb-4 md:pl-[130px] whitespace-normal">
              <div className="grid gap-3 rounded-md bg-white p-3.5 shadow-e1">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-label-sm">
                  <dt className="text-g-500">Who</dt>
                  <dd className="text-g-700">{who}</dd>
                  {auditRecord(event, timeZone).map((field) => (
                    <div key={field.label} className="contents">
                      <dt className="text-g-500">{field.label}</dt>
                      <dd
                        className={cn(
                          "break-all text-g-700",
                          field.label !== "When" && "font-mono text-[12px]"
                        )}
                      >
                        {field.value}
                      </dd>
                    </div>
                  ))}
                  {subject === undefined ? null : (
                    <>
                      <dt className="text-g-500">Open</dt>
                      <dd>
                        <SubjectLink subject={subject} className="text-blue" />
                      </dd>
                    </>
                  )}
                </dl>
                {data === null ?
                  null :
                  (
                    <pre className="max-h-[280px] overflow-auto rounded-sm bg-g-50 p-3 font-mono text-[12px] leading-relaxed text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-100)]">
                    {data}
                    </pre>
                  )}
              </div>
            </TableCell>
          </tr>
        ) :
        null}
    </>
  )
}
