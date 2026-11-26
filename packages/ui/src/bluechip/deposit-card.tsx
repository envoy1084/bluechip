import QrCodeStylingModule, { type Options as QrOptions } from "qr-code-styling"
import { type ReactNode, useEffect, useId, useState } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { usdcLogoDataUri } from "../logos/usdc.tsx"
import { AddressChip, shortAddress } from "./address-chip.tsx"

// The package ships CommonJS whose export is the class, while its types describe an ES module's default export, which
// TypeScript reads differently under NodeNext and Bundler resolution. Typed here as what it is at runtime.
const QRCodeStyling = QrCodeStylingModule as unknown as new(options: QrOptions) => {
  readonly getRawData: (extension: "svg") => Promise<Blob | null>
}

// Ink on white (`--color-ink`; the drawing's fill attributes can't read CSS variables). Quartile error
// correction keeps the code readable with the USDC mark over its middle, with fewer, larger dots than the highest level.
const QR_STYLE: QrOptions = {
  type: "svg",
  width: 296,
  height: 296,
  margin: 0,
  image: usdcLogoDataUri,
  qrOptions: { errorCorrectionLevel: "Q" },
  imageOptions: { imageSize: 0.3, margin: 6, hideBackgroundDots: true, saveAsBlob: false },
  dotsOptions: { type: "rounded", color: "#0a0b0d", roundSize: false },
  cornersSquareOptions: { type: "extra-rounded", color: "#0a0b0d" },
  cornersDotOptions: { type: "dot", color: "#0a0b0d" },
  backgroundOptions: { color: "#ffffff" }
}

/** The QR code of a payment request, as an image of the SVG qr-code-styling draws (it loads the mark first). */
function PaymentQrCode({ value, label }: Readonly<{ value: string; label: string }>) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    let current = true
    void new QRCodeStyling({ ...QR_STYLE, data: value }).getRawData("svg").then((svg) => {
      if (!current || svg === null) return
      url = URL.createObjectURL(svg)
      setSrc(url)
    })
    return () => {
      current = false
      if (url !== null) URL.revokeObjectURL(url)
    }
  }, [value])

  return src === null ?
    <span aria-hidden className="size-[148px]" /> :
    <img src={src} alt={label} width={148} height={148} className="size-[148px]" />
}

export interface DepositCardProps {
  /** Your account's address on Base, shown to copy. */
  readonly address: string
  /**
   * What the QR code holds: an EIP-681 request for a USDC transfer to `address` on Base
   * (`ethereum:<USDC>@8453/transfer?address=<address>`), so a wallet that scans it opens the transfer on the right
   * network with the recipient filled in.
   */
  readonly paymentRequest: string
  /** A heading, where the page around the card doesn't already say what it's for. */
  readonly title?: ReactNode
  /** Under the title. */
  readonly description?: ReactNode
  /** Under the address, like an "Add cash" button. */
  readonly footer?: ReactNode
  readonly className?: string
}

/**
 * Where to send cash: a QR code your wallet opens as a USDC transfer on Base, and your address to copy. The warning
 * is loud because other coins or networks can be lost.
 */
export function DepositCard({ address, paymentRequest, title, description, footer, className }: DepositCardProps) {
  const titleId = useId()

  return (
    <section
      data-slot="deposit-card"
      {...(title === undefined ? { "aria-label": "Your deposit address" } : { "aria-labelledby": titleId })}
      className={cn("grid w-full gap-[18px] rounded-lg bg-white p-5 shadow-e2", className)}
    >
      {title === undefined ? null : (
        <div className="grid gap-px">
          <h3 id={titleId} className="text-title-3 font-semibold">{title}</h3>
          {description === undefined ? null : <p className="text-label-sm text-g-500">{description}</p>}
        </div>
      )}
      <div className="grid justify-items-center gap-5 sm:grid-cols-[172px_minmax(0,1fr)] sm:items-center sm:justify-items-stretch">
        <figure className="m-0 grid size-[172px] place-items-center rounded-[18px] bg-white shadow-[var(--shadow-e2),0_0_0_1px_rgba(42,91,255,.08)]">
          <PaymentQrCode value={paymentRequest} label={`QR code to send USDC on Base to ${shortAddress(address)}`} />
        </figure>
        <div className="grid w-full min-w-0 gap-3">
          <div className="grid gap-0.5">
            <span className="text-label font-[550] text-g-800">Your address</span>
            <span className="text-label-sm text-g-500">Scan it with your wallet, or copy the address.</span>
          </div>
          <AddressChip address={address} full className="justify-self-start" />
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
