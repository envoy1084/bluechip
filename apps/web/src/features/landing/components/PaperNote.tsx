import { cn } from "@bluechip/ui/lib/cn"
import { site } from "../../../lib/seo/currentSite.ts"
import { sendsToPaper } from "../../../lib/seo/site.ts"

/**
 * One line beside the ways in while the landing sends people to the paper money app (the open beta before mainnet),
 * in the terms' words: test money, worth nothing. Nothing at all once the app is real money.
 */
export function PaperNote({ className }: Readonly<{ className?: string }>) {
  if (!sendsToPaper(site)) return null
  return (
    <p className={cn("max-w-[44ch] text-body-sm text-balance", className)}>
      Open beta on paper money: try everything with test dollars, nothing real at stake.
    </p>
  )
}
