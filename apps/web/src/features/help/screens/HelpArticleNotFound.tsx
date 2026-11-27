import { ButtonLink } from "@bluechip/ui/components/button"
import { Link } from "@tanstack/react-router"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { HelpFrame } from "../components/HelpFrame.tsx"

/** A help link to an article that doesn't exist (renamed, or mistyped): say so, and lead back to the help center. */
export function HelpArticleNotFound() {
  return (
    <HelpFrame>
      <div className="mx-auto grid max-w-[560px] gap-4">
        <h1 className="text-center text-title-1 font-semibold">We can't find that article</h1>
        <IllustratedEmpty
          illustration="magnifier"
          size={120}
          title="Nothing at this address"
          variant="plain"
          action={<ButtonLink variant="secondary" render={<Link to="/help" />}>See all help articles</ButtonLink>}
        >
          It may have moved, or the link is wrong.
        </IllustratedEmpty>
      </div>
    </HelpFrame>
  )
}
