import { Toaster } from "@bluechip/ui/components/toast"
import { TooltipProvider } from "@bluechip/ui/components/tooltip"
import { createFileRoute } from "@tanstack/react-router"
import {
  AccordionSection,
  CarouselSection,
  CollapsibleSection,
  ResizableSection
} from "../pages/navigation/disclosure.tsx"
import { MenubarSection, NavigationMenuSection, SidebarSection } from "../pages/navigation/menus.tsx"
import { BreadcrumbSection, PaginationSection, TabsSection } from "../pages/navigation/tabs-and-paging.tsx"

export const Route = createFileRoute("/navigation")({ component: KitNavigation })

function KitNavigation() {
  return (
    <TooltipProvider>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:px-10">
        <div className="grid gap-3">
          <h1 className="text-display-3 font-semibold">Navigation</h1>
          <p className="max-w-[64ch] text-body-lg text-g-600">
            Moving between places and views: tabs, trails, pages, menus and the app's sidebar, plus the disclosure
            patterns that tuck detail away until it's wanted.
          </p>
        </div>

        <TabsSection />
        <BreadcrumbSection />
        <PaginationSection />
        <NavigationMenuSection />
        <MenubarSection />
        <SidebarSection />
        <AccordionSection />
        <CollapsibleSection />
        <CarouselSection />
        <ResizableSection />
      </div>
      <Toaster />
    </TooltipProvider>
  )
}
