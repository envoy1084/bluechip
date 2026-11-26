import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription } from "@bluechip/ui/components/empty"
import { Icon } from "@bluechip/ui/icons/icon"

/**
 * Something that didn't load, said the same way everywhere: "We couldn't load your agents. Check your connection and
 * try again." with Try again. `safe` adds that your money wasn't touched, for pages about it. `plain` sits inside
 * another surface (a card, a list); `card` stands on the page; `sm` fits a row or a tab.
 */
export function LoadProblem(
  { what, onRetry, safe = false, variant = "plain", size = "md", className }: Readonly<{
    /** What couldn't load: "your agents", "this automation". */
    what: string
    onRetry: () => void
    safe?: boolean
    variant?: "plain" | "card"
    size?: "sm" | "md"
    className?: string
  }>
) {
  return (
    <Empty variant={variant === "card" ? "default" : "plain"} size={size} className={className}>
      <EmptyDescription>
        We couldn't load {what}. Check your connection and try again.
        {safe ? " Your money is safe, only this view didn't load." : null}
      </EmptyDescription>
      <EmptyContent>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <Icon name="refresh" size={14} />Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
