import type { AgentId } from "@bluechip/domain/Ids"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

/** Who asked for something: you, an agent, or where it came from (an automation, the assistant, Telegram, an app). */
export type Who =
  | { readonly _tag: "agent"; readonly id: AgentId; readonly name: string | undefined }
  | { readonly _tag: "source"; readonly source: Intent["source"] }

const SOURCE: Readonly<Record<Intent["source"], { readonly label: string; readonly icon: IconName }>> = {
  owner: { label: "You", icon: "user" },
  assistant: { label: "Assistant", icon: "chat" },
  automation: { label: "Automation", icon: "zap" },
  channel: { label: "Telegram", icon: "send" },
  mcp: { label: "An app", icon: "link" }
}

/**
 * Who asked, as a small grey chip: an agent with its butterfly, anyone else with an icon. `children` names it more
 * precisely than its source does (the automation's name, "Assistant, signed by you").
 */
export function WhoChip(
  { who, className, children }: Readonly<{ who: Who; className?: string; children?: ReactNode }>
) {
  const chip =
    "inline-flex h-[22px] w-fit shrink-0 items-center gap-1 rounded-full bg-g-100 px-2 text-caption font-medium whitespace-nowrap text-g-700"

  if (who._tag === "agent") {
    return (
      <span className={cn(chip, "pl-0.5", className)}>
        <AgentAvatar agentId={who.id} size="sm" className="size-[18px] rounded-full [&_canvas]:w-3" />
        {children ?? who.name ?? "An agent"}
      </span>
    )
  }

  const { label, icon } = SOURCE[who.source]
  return (
    <span className={cn(chip, className)}>
      <Icon name={icon} size={12} />
      {children ?? label}
    </span>
  )
}
