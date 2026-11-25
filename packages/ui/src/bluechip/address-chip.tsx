import { type ComponentProps, useEffect, useState } from "react"
import { toast } from "../components/toast.tsx"
import { CopyIcon } from "../icons/copy-icon.tsx"
import { cn } from "../lib/cn.ts"

/** The first six and last four characters: "0x7a3F…B9d4". */
export const shortAddress = (address: string): string =>
  address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`

const COPIED_FOR = 1600

export interface AddressChipProps extends Omit<ComponentProps<"span">, "children"> {
  readonly address: string
  /** The blue dot that says the address is on Base. Defaults to true. */
  readonly network?: boolean
  /** `inline` turns the copy icon into a check for a moment; `toast` also shows a toast. */
  readonly feedback?: "inline" | "toast"
}

/**
 * An account address, shortened, with a copy button. Only shown where you need it: deposits and receipts. Copying
 * shows a check for 1.6 s and is announced.
 */
export function AddressChip({ address, network = true, feedback = "inline", className, ...props }: AddressChipProps) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle")

  useEffect(() => {
    if (copied === "idle") return
    const timer = setTimeout(() => setCopied("idle"), COPIED_FOR)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = () => {
    navigator.clipboard.writeText(address).then(
      () => {
        setCopied("copied")
        if (feedback === "toast") toast.success("Address copied", { description: shortAddress(address) })
      },
      () => {
        setCopied("failed")
        if (feedback === "toast") {
          toast.error("Couldn't copy the address", { description: "Select it and copy it by hand." })
        }
      }
    )
  }

  return (
    <span
      data-slot="address-chip"
      data-state={copied}
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full bg-white py-1 pr-1 pl-3 text-[13.5px] font-[550] surface-field",
        className
      )}
      {...props}
    >
      {network && (
        <i
          aria-hidden
          title="Base network"
          className="size-2 shrink-0 rounded-full bg-blue shadow-[0_0_0_2.5px_var(--color-blue-100)]"
        />
      )}
      <span title={address} className="truncate font-mono text-label tracking-[-0.01em]">{shortAddress(address)}</span>
      <button
        type="button"
        aria-label="Copy address"
        onClick={copy}
        className={cn(
          "grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-g-50 text-g-500 transition-colors duration-fast ease-brand",
          "hover:bg-g-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue"
        )}
      >
        <CopyIcon copied={copied === "copied"} />
      </button>
      <span
        aria-live="polite"
        className={cn("text-caption pr-2 text-loss", (copied !== "failed" || feedback === "toast") && "sr-only")}
      >
        {copied === "copied" ? "Copied" : copied === "failed" ? "Couldn't copy" : ""}
      </span>
    </span>
  )
}
