import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import type { ReactNode } from "react"

/**
 * Nothing here yet, said with one of bluechip's illustrations in moving halftone (still under reduced motion), what
 * will appear and, when there is one, the way to start.
 */
export function IllustratedEmpty(
  { illustration, title, children, action, size = 140 }: Readonly<{
    illustration: IllustrationName
    title: string
    children: ReactNode
    action?: ReactNode
    size?: number
  }>
) {
  return (
    <Empty>
      <Illustration name={illustration} variant="halftone" size={size} animate className="-my-2" />
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{children}</EmptyDescription>
      {action === undefined ?
        null :
        <EmptyContent className="flex flex-wrap justify-center gap-2">{action}</EmptyContent>}
    </Empty>
  )
}
