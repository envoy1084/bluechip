import { agentAvatarVariants } from "@bluechip/ui/bluechip/agent-avatar"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"

/**
 * A small pixel illustration on the same raised tile as an agent's butterfly, leading a row the way a stock's chip
 * does: a deposit's chip stack, an automation's calendar. Decorative, since the row says what it is.
 */
export function IllustrationTile(
  { name, className }: Readonly<{ name: IllustrationName; className?: string }>
) {
  return (
    <span aria-hidden className={cn(agentAvatarVariants({ size: "md" }), "mt-0.5 self-start", className)}>
      <Illustration name={name} size={22} label="" />
    </span>
  )
}
