import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/kit")({ component: Kit })

function Kit() {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12">
      <h1 className="text-display-3 font-semibold">Kit</h1>
      <div className="flex flex-wrap gap-3">
        <Button>
          <Icon name="agent" size={16} />Create agent
        </Button>
        <Button variant="secondary">Edit limits</Button>
        <Button variant="danger">Pause all agents</Button>
        <Button loading>Approve</Button>
      </div>
    </main>
  )
}
