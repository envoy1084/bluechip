import type { HalftoneSceneName } from "@bluechip/ui/motion/halftone"
import { Halftone } from "@bluechip/ui/motion/halftone"
import type { ReactNode } from "react"

/** The full-screen frame of sign-up and sign-in: a halftone scene beside one focused step. */
export function OnboardingFrame(
  { children, scene, step }: Readonly<{ children: ReactNode; scene: HalftoneSceneName; step?: string }>
) {
  return (
    <main className="grid min-h-dvh bg-canvas md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative hidden overflow-hidden bg-g-50 md:block">
        <Halftone scene={scene} className="absolute inset-0 size-full" />
        <span className="absolute top-6 left-8 text-title-3 font-semibold tracking-tight">bluechip</span>
      </div>
      <div className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto grid w-full max-w-sm gap-8">
          <span className="text-title-3 font-semibold tracking-tight md:hidden">bluechip</span>
          {step === undefined ? null : <span className="text-caption font-medium text-g-500">{step}</span>}
          {children}
        </div>
      </div>
    </main>
  )
}
