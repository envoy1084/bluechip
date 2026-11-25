import { toast, Toaster } from "@bluechip/ui/components/toast"
import { TooltipProvider } from "@bluechip/ui/components/tooltip"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { AnchoredSections } from "../pages/overlays/anchored.tsx"
import { MenuSections } from "../pages/overlays/menus.tsx"
import { ModalSections } from "../pages/overlays/modals.tsx"

// `?open=<id>` opens one overlay on load, so a headless screenshot can show it.
export const Route = createFileRoute("/overlays")({
  component: KitOverlays,
  validateSearch: (search: Record<string, unknown>): { readonly open?: string } =>
    typeof search.open === "string" ? { open: search.open } : {}
})

function KitOverlays() {
  const { open } = Route.useSearch()

  useEffect(() => {
    if (open !== "toast") return
    toast.error("Your limit stopped this trade", {
      description: "Stock picker tried to spend $410. Max per trade is $250."
    })
    toast("Rebalancer paused", { description: "It won't trade until you turn it back on." })
    toast.success("Trade approved", { description: "Bought 2 NVDA for $362.84.", duration: 0 })
  }, [open])

  return (
    <TooltipProvider>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:px-10">
        <div className="grid gap-3">
          <h1 className="text-display-3 font-semibold">Overlays</h1>
          <p className="max-w-[64ch] text-body-lg text-g-600">
            Everything that floats above the page. Modals trap focus, lock scroll and give focus back; anchored panels
            follow their trigger. Esc always closes the top layer.
          </p>
        </div>

        <ModalSections open={open} />
        <AnchoredSections open={open} />
        <MenuSections open={open} />
      </div>
      <Toaster />
    </TooltipProvider>
  )
}
