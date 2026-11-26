import { toast } from "@bluechip/ui/components/toast"
import { CopyIcon } from "@bluechip/ui/icons/copy-icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useEffect, useState } from "react"

const COPIED_FOR = 1600

/**
 * A quiet button that copies `text` (a code, an id) beside where it's shown; a check shows for a moment once it's
 * copied, and a toast says so when it couldn't be. `what` names it: "Copy the code", "The code copied".
 */
export function CopyButton(
  { text, what, size = "sm", className }: Readonly<{
    text: string
    what: string
    size?: "sm" | "md"
    className?: string
  }>
) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FOR)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? `${what} copied` : `Copy ${what}`}
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => toast.error(`Couldn't copy ${what}`, { description: "Select it and copy it by hand." })
        )}
      className={cn(
        "grid shrink-0 cursor-pointer place-items-center rounded-full text-g-500 transition-colors duration-fast ease-brand",
        "hover:bg-g-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-blue",
        size === "md" ? "size-9 bg-white shadow-[0_0_0_1px_rgba(10,11,13,.08)]" : "size-6",
        className
      )}
    >
      <CopyIcon copied={copied} size={size === "md" ? 16 : 12} />
    </button>
  )
}
