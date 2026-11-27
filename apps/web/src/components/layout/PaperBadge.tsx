import { Badge } from "@bluechip/ui/components/badge"
import { cn } from "@bluechip/ui/lib/cn"
import { network } from "../../lib/network.ts"

/** "Paper money", next to the logo wherever it shows, only on paper money (Base Sepolia). */
export function PaperBadge({ className }: Readonly<{ className?: string }>) {
  if (network !== "sepolia") return null
  return <Badge variant="warning" className={className}>Paper money</Badge>
}

/** A thin strip over every signed-in page on paper money, so nobody mistakes it for real money. */
export function PaperBanner({ className }: Readonly<{ className?: string }>) {
  if (network !== "sepolia") return null
  return (
    <div
      role="note"
      className={cn(
        "border-b border-warn-line bg-warn-wash px-4 py-1.5 text-center text-caption font-medium text-warn",
        className
      )}
    >
      Paper money: test dollars on Base Sepolia at live prices. Nothing here is worth real money.
    </div>
  )
}
