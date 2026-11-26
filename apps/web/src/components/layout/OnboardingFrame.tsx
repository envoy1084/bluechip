import { Logo } from "@bluechip/ui/bluechip/logo"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

const STEPS = ["Account", "Eligibility", "Deposit"] as const

/** Where the person is in setup; without a step the header links home instead of showing progress. */
export type OnboardingStep = (typeof STEPS)[number]

/** Sign-up and sign-in: the lockup and setup progress, one centered column, and the eligibility fine print. */
export function OnboardingFrame(
  { children, step, wide = false }: Readonly<{ children: ReactNode; step?: OnboardingStep; wide?: boolean }>
) {
  const at = step === undefined ? -1 : STEPS.indexOf(step)
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,var(--color-blue-50),transparent_70%),var(--color-canvas)]">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-7 sm:py-4">
        <Link to="/" aria-label="bluechip home">
          <Logo />
        </Link>
        {step === undefined ? null : (
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Setup progress">
            {STEPS.map((label, index) => (
              <li
                key={label}
                aria-current={index === at ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-[7px] text-[12.5px] font-semibold whitespace-nowrap text-g-500",
                  "[&+&]:before:mr-px [&+&]:before:h-0.5 [&+&]:before:w-4 [&+&]:before:rounded-[1px] [&+&]:before:bg-g-200",
                  index === at && "text-ink",
                  index !== at && "max-sm:gap-0 max-sm:text-[0px]"
                )}
              >
                <i
                  className={cn(
                    "grid size-5 place-items-center rounded-full bg-white text-[11px] not-italic shadow-[inset_0_0_0_1.5px_var(--color-g-200)]",
                    index === at &&
                      "text-blue shadow-[inset_0_0_0_1.5px_var(--color-blue),0_0_0_3px_rgba(42,91,255,.1)]",
                    index < at &&
                      "bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
                  )}
                >
                  {index < at ? <Icon name="check" size={11} /> : index + 1}
                </i>
                {label}
              </li>
            ))}
          </ol>
        )}
      </header>
      <main className="grid flex-1 content-start justify-items-center px-5 pt-6 pb-10 [view-transition-name:page] sm:pt-10">
        <div
          className={cn(
            "grid w-full justify-items-center gap-3.5 text-center",
            wide ? "max-w-[620px]" : "max-w-[440px]"
          )}
        >
          {children}
        </div>
      </main>
      <p className="px-5 pt-4 pb-5 text-center text-[12px] text-g-500">
        Not available to people in the United States. bluechip is not affiliated with Coinbase, Base or any token named
        BLUECHIP.
      </p>
    </div>
  )
}

/** The large heading and lead of an onboarding step. */
export function OnboardingTitle({ title, children }: Readonly<{ title: ReactNode; children?: ReactNode }>) {
  return (
    <>
      <h1 className="text-[28px] leading-[1.12] font-semibold tracking-[-0.035em] max-sm:text-2xl">{title}</h1>
      {children === undefined ? null : <p className="max-w-[42ch] text-[15px] text-g-600">{children}</p>}
    </>
  )
}
