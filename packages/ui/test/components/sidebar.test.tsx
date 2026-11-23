import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "@bluechip/ui/components/sidebar"
import { Icon } from "@bluechip/ui/icons/icon"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

function AppFrame() {
  return (
    <SidebarProvider className="min-h-0">
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="Agents">
                <Icon name="agents" />
                <span>Agents</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
      </SidebarInset>
    </SidebarProvider>
  )
}

describe("Sidebar", () => {
  afterEach(() => page.viewport(414, 896))

  it("collapses to icons from its trigger and from ⌘B", async () => {
    await page.viewport(1280, 800)
    await render(<AppFrame />)
    const sidebar = page.getByRole("complementary", { name: "App navigation" })
    const trigger = page.getByRole("button", { name: "Toggle sidebar" })
    await expect.element(sidebar).toHaveAttribute("data-state", "expanded")
    await expect.element(page.getByRole("button", { name: "Agents" })).toHaveAttribute("aria-current", "page")

    await userEvent.click(trigger)
    await expect.element(sidebar).toHaveAttribute("data-state", "collapsed")
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false")

    await userEvent.keyboard("{Meta>}b{/Meta}")
    await expect.element(sidebar).toHaveAttribute("data-state", "expanded")
  })

  it("opens as a sheet on phones", async () => {
    await page.viewport(390, 800)
    await render(<AppFrame />)
    await expect.element(page.getByRole("complementary")).not.toBeInTheDocument()

    await userEvent.click(page.getByRole("button", { name: "Toggle sidebar" }))
    await expect.element(page.getByRole("dialog", { name: "App navigation" })).toBeVisible()
    await expect.element(page.getByRole("button", { name: "Agents" })).toBeVisible()
  })
})
