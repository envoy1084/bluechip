import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Link } from "@tanstack/react-router"
import { AppPage } from "../../../components/layout/AppPage.tsx"

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
        (
          <div className="grid justify-items-center gap-3 py-10 text-center">
            <p className="text-body-sm text-g-600">We couldn't load {what}. Check your connection and try again.</p>
            <Button variant="secondary" onClick={onRetry}>Try again</Button>
          </div>
        ) :
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
      <Empty>
        <EmptyTitle>We can't find that automation</EmptyTitle>
        <EmptyDescription>It may have been deleted, or the link is wrong.</EmptyDescription>
        <EmptyContent>
          <ButtonLink variant="secondary" render={<Link to="/automations" />}>See your automations</ButtonLink>
        </EmptyContent>
      </Empty>
    </AppPage>
  )
}
