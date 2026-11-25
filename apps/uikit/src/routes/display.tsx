import { createFileRoute } from "@tanstack/react-router"
import { CardSection, DataTableSection, TableSection } from "../pages/display/cards-and-tables.tsx"
import { AvatarSection, BadgeSection, ChartSection, KbdSection } from "../pages/display/charts-and-labels.tsx"
import { AlertSection, EmptySection, ProgressSection, SkeletonSection } from "../pages/display/feedback.tsx"
import { AspectRatioSection, ScrollAreaSection, SeparatorSection } from "../pages/display/layout-demos.tsx"
import { Group } from "../pages/display/layout.tsx"

export const Route = createFileRoute("/display")({ component: KitDisplay })

function KitDisplay() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">Interface</span>
        <h1 className="text-display-3 font-semibold">Data display</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          How bluechip shows what you own and what your agents did: cards, tables, charts and the small labels around
          them, plus the feedback and layout pieces that hold a screen together.
        </p>
      </div>
      <Group n="01" title="Data display">
        <CardSection />
        <TableSection />
        <DataTableSection />
        <ChartSection />
        <AvatarSection />
        <BadgeSection />
        <KbdSection />
      </Group>
      <Group n="02" title="Feedback">
        <AlertSection />
        <ProgressSection />
        <SkeletonSection />
        <EmptySection />
      </Group>
      <Group n="03" title="Layout">
        <SeparatorSection />
        <AspectRatioSection />
        <ScrollAreaSection />
      </Group>
    </div>
  )
}
