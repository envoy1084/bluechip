import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: KitOverview })

function KitOverview() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:px-10">
      <div className="grid gap-3">
        <h1 className="text-display-3 font-semibold">@bluechip/ui</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          Every component, animation and illustration of the web app, built from the brand kit. Pick a section on the
          left.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button>
          <Icon name="agent" size={16} />Create agent
        </Button>
        <Button variant="secondary">Edit limits</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Pause all agents</Button>
        <Button loading>Approve</Button>
      </div>
    </div>
  )
}
