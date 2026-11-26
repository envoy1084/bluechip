import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import { PageSection } from "../../../components/layout/PageSection.tsx"
import type { Need, Tone } from "../model/needsYou.ts"

const ICONS: Readonly<Record<string, IconName>> = {
  recovery: "shield",
  approvals: "face-id",
  automations: "zap",
  ranOut: "hourglass",
  endingSoon: "timer",
  drafts: "unlock",
  idleCash: "cash",
  recoveryKey: "key"
}

const TONES: Readonly<Record<Tone, string>> = {
  urgent: "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]",
  warn: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
  info: "surface-well text-g-600"
}

function NeedButton({ need, onReviewApprovals }: Readonly<{ need: Need; onReviewApprovals: () => void }>) {
  const label = need.actionLabel
  const variant = need.tone === "info" ? "ghost" : "secondary"
  const { action } = need

  switch (action._tag) {
    case "approvals":
      return <Button variant={variant} size="sm" onClick={onReviewApprovals}>{label}</Button>
    case "security":
      return <ButtonLink variant={variant} size="sm" render={<Link to="/settings/security" />}>{label}</ButtonLink>
    case "agent":
      return (
        <ButtonLink
          variant={variant}
          size="sm"
          render={<Link to="/agents/$agentId" params={{ agentId: action.agentId }} />}
        >
          {label}
        </ButtonLink>
      )
    case "agents":
      return <ButtonLink variant={variant} size="sm" render={<Link to="/agents" />}>{label}</ButtonLink>
    case "newAgent":
      return <ButtonLink variant={variant} size="sm" render={<Link to="/agents/new" />}>{label}</ButtonLink>
    case "automation":
      return (
        <ButtonLink
          variant={variant}
          size="sm"
          render={<Link to="/automations/$automationId" params={{ automationId: action.automationId }} />}
        >
          {label}
        </ButtonLink>
      )
    case "automations":
      return <ButtonLink variant={variant} size="sm" render={<Link to="/automations" />}>{label}</ButtonLink>
  }
}

/**
 * What needs you, one line each with its way to act, the most pressing first. Nothing at all when nothing does.
 * `onReviewApprovals` opens the approvals.
 */
export function NeedsYou(
  { needs, onReviewApprovals }: Readonly<{ needs: ReadonlyArray<Need>; onReviewApprovals: () => void }>
) {
  if (needs.length === 0) return null

  return (
    <PageSection title="Needs you">
      <ul className="overflow-hidden rounded-lg bg-white shadow-e2">
        {needs.map((need) => (
          <li
            key={need.key}
            className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-g-100 px-4 py-3.5 last:border-b-0 motion-safe:animate-fade-in"
          >
            <span className="flex min-w-0 flex-[1_1_240px] items-start gap-3">
              <span
                aria-hidden
                className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px]", TONES[need.tone])}
              >
                <Icon name={ICONS[need.key] ?? "info"} size={16} />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <b className="text-body-sm font-semibold text-pretty">{need.title}</b>
                <span className="text-label-sm text-pretty text-g-600">{need.detail}</span>
              </span>
            </span>
            <span className="ml-auto shrink-0">
              <NeedButton need={need} onReviewApprovals={onReviewApprovals} />
            </span>
          </li>
        ))}
      </ul>
    </PageSection>
  )
}
