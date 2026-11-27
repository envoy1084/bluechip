import type { Me } from "@bluechip/domain/Account"
import { Logo } from "@bluechip/ui/bluechip/logo"
import { Button } from "@bluechip/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@bluechip/ui/components/dialog"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Navigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { meAtom } from "../atoms/account.ts"
import { accountView } from "../lib/accountView.ts"
import { IllustratedEmpty } from "./IllustratedEmpty.tsx"
import { LoadProblem } from "./LoadProblem.tsx"
import { PasskeySignIn } from "./PasskeySignIn.tsx"

/** A page of its own for when the account itself can't be shown: the logo, then what happened. */
function Standalone({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="grid min-h-dvh content-start justify-items-center gap-10 bg-canvas px-4 pt-6 pb-10">
      <Logo />
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

/**
 * Renders its children for the signed-in user. Without a session it sends the visitor to the landing page to sign
 * in; if the session ends while they are here (expired or signed out elsewhere), it offers to sign in again on the
 * spot instead of yanking the page away. An app older than the server asks for a reload; any other failure keeps
 * the account already shown.
 */
export function SignedIn({ children }: Readonly<{ children: (me: Me) => ReactNode }>) {
  const view = accountView(useAtomValue(meAtom))
  const refresh = useAtomRefresh(meAtom)

  if (view._tag === "signedIn") return children(view.me)
  if (view._tag === "loading") {
    return (
      <div className="mx-auto grid max-w-md gap-3 px-4 py-24" aria-busy>
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    )
  }

  if (view._tag === "outdated") {
    return (
      <Standalone>
        <IllustratedEmpty
          illustration="paper-plane"
          size={120}
          title="A new version of bluechip is ready"
          action={
            <Button onClick={() => window.location.reload()}>
              <Icon name="refresh" size={14} />Reload
            </Button>
          }
        >
          Reload to keep using the app. Your agents keep trading inside their limits meanwhile.
        </IllustratedEmpty>
      </Standalone>
    )
  }

  if (view._tag === "signIn") return <Navigate to="/welcome" />
  if (view._tag === "signInAgain") {
    return (
      <Dialog open>
        <DialogContent showCloseButton={false} className="grid justify-items-center gap-2 p-8 text-center">
          <Illustration name="passkey" size={56} />
          <DialogTitle>Sign in again to continue</DialogTitle>
          <DialogDescription>
            For your safety you're signed out after 30 days, or when you sign out on another tab.
          </DialogDescription>
          <div className="mt-2 grid w-full gap-2">
            {/* Signing in refreshes the account, and this page carries on where it was. */}
            <PasskeySignIn variant="primary" onSignedIn={() => undefined} />
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Standalone>
      <LoadProblem what="your account" onRetry={refresh} variant="card" safe />
    </Standalone>
  )
}
