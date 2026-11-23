import { type ReactNode, useEffect, useState } from "react"
import { Button, type ButtonProps } from "../components/button.tsx"
import { Spinner } from "../components/spinner.tsx"
import { TextMorph } from "../components/text-morph.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { haptic } from "../lib/haptics.ts"
import { Seal } from "../motion/seal.tsx"

/** How the person proves it's them. The button always names it. */
export type PasskeyMethod = "face-id" | "fingerprint"

/** Where a passkey request is. */
export type PasskeyState = "idle" | "waiting" | "done" | "error"

const METHOD_NAME: Readonly<Record<PasskeyMethod, string>> = { "face-id": "Face ID", fingerprint: "fingerprint" }

export interface PasskeyButtonProps extends Omit<ButtonProps, "children" | "onClick" | "loading"> {
  readonly method?: PasskeyMethod
  /** The action, naming the method: "Create account with Face ID". */
  readonly children: ReactNode
  /** What it says once it worked: "Account created". */
  readonly doneLabel: ReactNode
  /** Runs the passkey request. Resolve when it passes, reject when it fails or is cancelled. */
  readonly onAuthenticate: () => Promise<void>
  /** Milliseconds the done state stays before the button resets. Defaults to 1500. */
  readonly resetAfter?: number
}

/**
 * The one button for anything that needs you: creating your account, signing in, approving a trade, locking limits.
 * Waiting says so, success forms the seal, turns green and taps a success haptic on phones, and a failure asks to try
 * again, never with a code. The label morphs between states (string labels only).
 */
export function PasskeyButton({
  method = "face-id",
  children,
  doneLabel,
  onAuthenticate,
  resetAfter = 1500,
  className,
  ...props
}: PasskeyButtonProps) {
  const [state, setState] = useState<PasskeyState>("idle")
  const name = METHOD_NAME[method]

  useEffect(() => {
    if (state !== "done") return
    const timer = setTimeout(() => setState("idle"), resetAfter)
    return () => clearTimeout(timer)
  }, [state, resetAfter])

  const start = () => {
    setState("waiting")
    onAuthenticate().then(
      () => {
        haptic("success")
        setState("done")
      },
      () => setState("error")
    )
  }

  const icon = method === "face-id" ? "face-id" : "fingerprint"
  return (
    <span data-slot="passkey-button" data-state={state} className={cn("inline-grid gap-1.5 text-center", className)}>
      <Button
        aria-busy={state === "waiting" || undefined}
        onClick={() => {
          if (state === "idle" || state === "error") {
            start()
          }
        }}
        className={cn(
          "w-full gap-2.5 transition-[background,box-shadow,filter,translate] duration-slow",
          state === "done" &&
            "bg-[linear-gradient(180deg,#23a463,var(--color-gain))] text-white [text-shadow:none] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_0_0_1px_#0c7a40,0_6px_14px_-4px_rgba(15,138,74,.45)]"
        )}
        {...props}
      >
        {state === "waiting" ?
          <Spinner size={16} /> :
          state === "done" ?
          <Seal playing label={`Done with ${name}`} className="size-5" /> :
          <Icon name={icon} size={18} />}
        <TextMorph>
          {state === "waiting"
            ? `Waiting for ${name}…`
            : state === "done"
            ? doneLabel
            : state === "error"
            ? `Try ${name} again`
            : children}
        </TextMorph>
      </Button>
      <span aria-live="polite" className={cn("text-label-sm text-loss", state !== "error" && "sr-only")}>
        {state === "error" ? `${name === "Face ID" ? "Face ID" : "Your fingerprint"} didn't work. Try again.` : ""}
      </span>
    </span>
  )
}
