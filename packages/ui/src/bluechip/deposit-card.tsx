import { type ReactNode, useEffect, useId, useMemo, useState } from "react"
import { encode } from "uqr"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { haptic } from "../lib/haptics.ts"
import { UsdcLogo } from "../logos/usdc.tsx"
import { Confetti } from "../motion/confetti.tsx"
import { NumberRoll } from "../motion/number-roll.tsx"
import { MomentScope, useMoment } from "../motion/sweep.tsx"
import { AddressChip, shortAddress } from "./address-chip.tsx"

// The address as an EIP-681 link on Base (chain 8453), so a wallet that scans it also picks the right network. High
// error correction keeps the code readable under the mark in the middle.
const qrCode = (address: string): { readonly size: number; readonly path: string } => {
  const { data, size } = encode(`ethereum:${address}@8453`, { ecc: "H", border: 0 })
  const cells: Array<string> = []
  data.forEach((row, y) => row.forEach((dark, x) => dark && cells.push(`M${x} ${y}h1v1h-1z`)))
  return { size, path: cells.join("") }
}

export interface DepositCardProps {
  /** Your account's address on Base. */
  readonly address: string
  readonly status: "waiting" | "arrived"
  /** Arrived: how much cash came in. */
  readonly amount?: number
  /** Arrived: who sent it. */
  readonly from?: string
  /** Under the address while waiting, or under the amount once it arrived, like a "Show address again" button. */
  readonly footer?: ReactNode
  /** Celebrate with confetti when it arrives: a first deposit, once per account. */
  readonly celebrate?: boolean
  readonly className?: string
}

/**
 * How to add cash: send USDC on Base to your address. The warning is loud because other coins or networks can be
 * lost. When the deposit lands, a sweep passes over the card, the amount rolls up from zero and phones get a success
 * haptic.
 */
export function DepositCard(
  { address, status, amount = 0, from, footer, celebrate = false, className }: DepositCardProps
) {
  const qr = useMemo(() => qrCode(address), [address])
  const titleId = useId()
  const { ref: momentRef, play: playMoment } = useMoment()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (status !== "arrived") return
    // After the first paint, so the amount visibly rolls up from zero.
    const frame = requestAnimationFrame(() => setShown(amount))
    return () => cancelAnimationFrame(frame)
  }, [status, amount])
  useEffect(() => {
    if (status !== "arrived") return
    playMoment()
    haptic("success")
  }, [status, playMoment])

  if (status === "arrived") {
    return (
      <section
        data-slot="deposit-card"
        data-state="arrived"
        aria-label="Cash arrived"
        className={cn(
          "relative grid w-full max-w-[560px] justify-items-center gap-1.5 rounded-lg bg-white px-5 pt-[38px] pb-[26px] text-center shadow-[var(--shadow-e2),0_0_0_1px_var(--color-gain-line)]",
          className
        )}
      >
        {celebrate && <Confetti />}
        <span className="mb-2 grid size-[52px] animate-pop-in place-items-center rounded-[16px] bg-[linear-gradient(180deg,#23a463,var(--color-gain))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_6px_14px_-6px_rgba(15,138,74,.3)]">
          <Icon name="check" size={22} />
        </span>
        <span className="text-label text-g-600">Cash arrived</span>
        <NumberRoll
          value={shown}
          format={formatMoney}
          className="text-[32px] leading-[1.1] font-semibold tracking-[-0.035em]"
        />
        <output className="block max-w-[38ch] text-body-sm text-g-600">
          USDC on Base{from ? `, from ${shortAddress(from)}` : ""}. It's ready to invest.
        </output>
        {footer}
        <MomentScope ref={momentRef} />
      </section>
    )
  }

  return (
    <section
      data-slot="deposit-card"
      data-state="waiting"
      aria-labelledby={titleId}
      className={cn("grid w-full max-w-[560px] gap-[18px] rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-px">
          <h3 id={titleId} className="text-title-3 font-semibold">Add cash</h3>
          <span className="text-label-sm text-g-500">Send USDC to your bluechip account</span>
        </div>
        <output className="inline-flex items-center gap-2 rounded-full bg-blue-50 py-1 pr-[11px] pl-[9px] text-label-sm font-[550] text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
          <i aria-hidden className="size-[7px] animate-pulse rounded-full bg-blue" />Waiting for your deposit
        </output>
      </div>
      <div className="grid justify-items-center gap-5 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-start sm:justify-items-stretch">
        <figure className="relative m-0 size-[168px] rounded-[16px] bg-white p-3 shadow-e2">
          <svg
            viewBox={`0 0 ${qr.size} ${qr.size}`}
            className="block size-36"
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR code for ${shortAddress(address)}`}
          >
            <path d={qr.path} fill="var(--color-ink)" />
          </svg>
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 grid size-8 -translate-1/2 place-items-center rounded-[9px] bg-white shadow-[0_0_0_1px_rgba(10,11,13,.06)]"
          >
            <UsdcLogo size={22} />
          </span>
        </figure>
        <div className="grid w-full min-w-0 gap-3">
          <span className="text-label font-[550] text-g-800">Your address</span>
          <AddressChip address={address} className="justify-self-start" />
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-md bg-warn-wash px-3 py-[11px] text-label leading-[1.45] text-[#6b4a00] shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
          >
            <Icon name="warning" size={16} className="mt-px text-warn" />
            <span>
              <b className="text-[#4d3500]">Base network, USDC only.</b>{" "}
              Sending other coins, or USDC on another network, can't be undone and may be lost.
            </span>
          </div>
          {footer}
        </div>
      </div>
    </section>
  )
}
