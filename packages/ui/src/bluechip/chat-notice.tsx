import type { ReactNode } from "react"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export interface ChatNoticeProps {
  readonly icon: IconName
  /** Quiet when you stopped it (cancelled, the connection dropped); a warning when bluechip did. */
  readonly quiet?: boolean
  readonly children: ReactNode
}

/** Why the assistant stopped early, one line in the conversation: quiet when you stopped it, a warning otherwise. */
export function ChatNotice({ icon, quiet = false, children }: ChatNoticeProps) {
  return (
    <p
      data-slot="chat-notice"
      data-quiet={quiet || undefined}
      className={cn(
        "inline-flex items-start gap-1.5 justify-self-start rounded-[10px] py-1.5 pr-3 pl-2.5 text-label",
        quiet ?
          "text-g-500" :
          "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
      )}
    >
      <Icon name={icon} size={14} className="mt-[2px] shrink-0" />
      {children}
    </p>
  )
}
