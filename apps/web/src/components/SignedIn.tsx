import type { Me } from "@bluechip/domain/Account"
import { Unauthenticated } from "@bluechip/domain/Errors"
import { Button } from "@bluechip/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@bluechip/ui/components/dialog"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Navigate, useNavigate } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ReactNode } from "react"
import { meAtom } from "../atoms/account.ts"

/**
 * Renders its children for the signed-in user. Without a session it sends the visitor to sign in; if the session ends
 * while they are here (expired or signed out elsewhere), it says so instead of yanking the page away.
 */
export function SignedIn({ children }: Readonly<{ children: (me: Me) => ReactNode }>) {
  const result = useAtomValue(meAtom)
  const refresh = useAtomRefresh(meAtom)
  const navigate = useNavigate()

  if (AsyncResult.isSuccess(result)) return children(result.value)
  if (AsyncResult.isInitial(result)) {
    return (
      <div className="mx-auto grid max-w-md gap-3 px-4 py-24" aria-busy>
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    )
  }
  const unauthenticated = Option.exists(AsyncResult.error(result), (error) => error instanceof Unauthenticated)
  // A failure keeps the last success: a user we already showed was signed in a moment ago.
  const wasSignedIn = Option.isSome(AsyncResult.value(result))
  if (unauthenticated && !wasSignedIn) return <Navigate to="/signin" />
  if (unauthenticated) {
    return (
      <Dialog open>
        <DialogContent showCloseButton={false} className="grid justify-items-center gap-2 p-8 text-center">
          <Illustration name="passkey" size={56} />
          <DialogTitle>Sign in again to continue</DialogTitle>
          <DialogDescription>
            For your safety you're signed out after 30 days, or when you sign out on another tab.
          </DialogDescription>
          <Button className="mt-2" onClick={() => navigate({ to: "/signin" })}>
            <Icon name="face-id" size={14} />Sign in with Face ID
          </Button>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <div className="mx-auto grid max-w-md gap-4 px-4 py-24 text-center">
      <p className="text-body text-g-600">We couldn't load your account. Check your connection and try again.</p>
      <Button variant="secondary" onClick={refresh}>Try again</Button>
    </div>
  )
}
