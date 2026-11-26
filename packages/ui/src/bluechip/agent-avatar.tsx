import { cva, type VariantProps } from "class-variance-authority"
import { type ComponentProps, useEffect, useRef } from "react"
import { Illustration } from "../illustrations/illustration.tsx"
import { paintButterfly } from "../lib/butterfly.ts"
import { cn } from "../lib/cn.ts"

export const agentAvatarVariants = cva(
  [
    "relative grid shrink-0 place-items-center bg-[linear-gradient(180deg,#ffffff,#eef1f6)]",
    "shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08),0_1px_3px_-1px_rgba(10,11,13,.07)]"
  ],
  {
    variants: {
      size: {
        sm: "size-[26px] rounded-sm [&_canvas]:w-[18px]",
        md: "size-[34px] rounded-md [&_canvas]:w-6",
        lg: "size-11 rounded-[12px] [&_canvas]:w-[30px]",
        xl: "size-[72px] rounded-xl [&_canvas]:w-[50px]"
      }
    },
    defaultVariants: { size: "md" }
  }
)

/** What an agent is doing, shown as a dot in the avatar's corner. */
export type AgentStatus = "active" | "waiting" | "paused" | "stopped" | "idle"

const STATUS_DOT: Readonly<Record<AgentStatus, string>> = {
  active: "bg-green",
  waiting: "bg-blue",
  paused: "bg-[#e0a400]",
  stopped: "bg-loss",
  idle: "bg-g-300"
}

const DOT_SIZE = {
  sm: "-right-0.5 -bottom-0.5 size-[9px] shadow-[0_0_0_2px_#fff]",
  md: "-right-0.5 -bottom-0.5 size-[9px] shadow-[0_0_0_2px_#fff]",
  lg: "-right-0.5 -bottom-0.5 size-2.5 shadow-[0_0_0_2px_#fff]",
  xl: "-right-[3px] -bottom-[3px] size-3.5 shadow-[0_0_0_3px_#fff]"
} as const

export interface AgentAvatarProps
  extends Omit<ComponentProps<"span">, "children">, VariantProps<typeof agentAvatarVariants>
{
  /** The agent's id or name: the same id always hatches the same butterfly. */
  readonly agentId: string
  /** A status dot in the corner. Name the status in text nearby; the dot is decorative. */
  readonly status?: AgentStatus
  /** A removed agent: the butterfly is greyed out. */
  readonly removed?: boolean
  /** Accessible name. Without one the avatar is decorative, because the agent's name is shown beside it. */
  readonly label?: string
}

/** An agent's pixel butterfly on a raised tile, sized sm 26, md 34, lg 44, xl 72 px. */
export function AgentAvatar({ agentId, size, status, removed = false, label, className, ...props }: AgentAvatarProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) paintButterfly(ref.current, agentId)
  }, [agentId])
  return (
    <span
      data-slot="agent-avatar"
      data-status={status}
      className={cn(agentAvatarVariants({ size }), removed && "opacity-45 grayscale", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      {...props}
    >
      <canvas ref={ref} width={9} height={7} className="block h-auto [image-rendering:pixelated]" />
      {status && (
        <i
          data-slot="agent-avatar-status"
          className={cn("absolute rounded-full", DOT_SIZE[size ?? "md"], STATUS_DOT[status])}
        />
      )}
    </span>
  )
}

const ACCOUNT_ART: Readonly<Record<"sm" | "md" | "lg" | "xl", number>> = { sm: 18, md: 24, lg: 30, xl: 50 }

/**
 * Your own account on the same raised tile as an agent's butterfly, drawn with the pixel wallet, so a list of who
 * trades (you, then your agents) reads as one set.
 */
export function AccountAvatar(
  { size = "md", label = "My account", className, ...props }: Omit<ComponentProps<"span">, "children"> & {
    readonly size?: "sm" | "md" | "lg" | "xl"
    readonly label?: string
  }
) {
  return (
    <span
      data-slot="account-avatar"
      className={cn(agentAvatarVariants({ size }), className)}
      {...props}
    >
      <Illustration name="wallet" size={ACCOUNT_ART[size]} label={label} />
    </span>
  )
}
