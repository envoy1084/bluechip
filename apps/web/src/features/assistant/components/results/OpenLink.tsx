import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link, type LinkComponentProps } from "@tanstack/react-router"

/** The way from a result card to its full page: a quiet "Open" (or "See all") at the card's corner. */
export function OpenLink(
  { label = "Open", ...link }: Readonly<{ label?: string } & Pick<LinkComponentProps, "to" | "params" | "search">>
) {
  return (
    <ButtonLink variant="ghost" size="xs" className="gap-1 text-g-600" render={<Link {...link} />}>
      {label}
      <Icon name="arrow-right" size={14} />
    </ButtonLink>
  )
}

/** The rows a result card left out, said in its footer; nothing when it shows them all. */
export const more = (count: number) =>
  count <= 0 ? {} : { footer: <span className="py-1.5 text-caption text-g-500">And {count} more</span> }
