import { ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Link } from "@tanstack/react-router"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"

/** A page of this feature while what it shows loads, or after it couldn't: one line and Try again. */
export function ScreenState(
  { title, failed, what, onRetry }: Readonly<{
    title: string
    failed: boolean
    /** What couldn't load: "this automation". */
    what: string
    onRetry: () => void
  }>
) {
  return (
    <AppPage title={title} width="wide">
      {failed ?
        <LoadProblem what={what} onRetry={onRetry} /> :
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="h-[112px] w-full rounded-lg" />
            <SkeletonBlock className="h-64 w-full rounded-lg" />
          </div>
        )}
    </AppPage>
  )
}

/** An automation id that is malformed, deleted, or not this account's. */
export function AutomationNotFound() {
  return (
    <AppPage title="Automation not found">
      <IllustratedEmpty
        illustration="magnifier"
        size={120}
        title="We can't find that automation"
        action={<ButtonLink variant="secondary" render={<Link to="/automations" />}>See your automations</ButtonLink>}
      >
        It may have been deleted, or the link is wrong.
      </IllustratedEmpty>
    </AppPage>
  )
}
