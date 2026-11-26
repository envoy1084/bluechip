import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  type SidebarProps,
  SidebarProvider,
  type SidebarProviderProps,
  SidebarRail,
  SidebarTrigger
} from "@bluechip/ui/components/sidebar"
import { Icon } from "@bluechip/ui/icons/icon"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const DEFAULTS = {}

function AppFrame(
  { provider = DEFAULTS, sidebar = DEFAULTS }: {
    readonly provider?: Omit<SidebarProviderProps, "children">
    readonly sidebar?: Omit<SidebarProps, "children">
  }
) {
  return (
    <SidebarProvider className="min-h-0" {...provider}>
      <Sidebar {...sidebar}>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="Agents">
                <Icon name="agents" />
                <span>Agents</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Icon name="activity" />
                <span>Activity</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
      </SidebarInset>
    </SidebarProvider>
  )
}

const sidebar = () => page.getByRole("complementary", { name: "App navigation" })
const trigger = () => page.getByRole("button", { name: "Toggle sidebar" })

describe("Sidebar", () => {
  afterEach(() => page.viewport(414, 896))

  describe("on desktop", () => {
    it("starts expanded", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "expanded")
    })

    it("defaultOpen false starts collapsed", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ defaultOpen: false }} />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
    })

    it("its trigger collapses it", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await userEvent.click(trigger())
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
    })

    it("its trigger reports whether it's expanded", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await userEvent.click(trigger())
      await expect.element(trigger()).toHaveAttribute("aria-expanded", "false")
    })

    it("⌘B toggles it", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "expanded")
      await userEvent.keyboard("{Meta>}b{/Meta}")
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
    })

    it("Ctrl+B toggles it", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "expanded")
      await userEvent.keyboard("{Control>}b{/Control}")
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
    })

    it("B without ⌘ or Ctrl does nothing", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "expanded")
      // Had B toggled it, the trigger's press would expand it again.
      await userEvent.keyboard("b")
      await userEvent.click(trigger())
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
    })

    it("reports a toggle through onOpenChange", async () => {
      const changes: Array<boolean> = []
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ onOpenChange: (open) => changes.push(open) }} />)
      await userEvent.click(trigger())
      expect(changes).toEqual([false])
    })

    it("a controlled open stays where its owner puts it", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ open: true, onOpenChange: () => {} }} />)
      await userEvent.click(trigger())
      await expect.element(sidebar()).toHaveAttribute("data-state", "expanded")
    })

    it("collapsible none stays expanded when collapsed", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ defaultOpen: false }} sidebar={{ collapsible: "none" }} />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "expanded")
    })

    it("its rail collapses it", async () => {
      await page.viewport(1280, 800)
      const screen = await render(<AppFrame />)
      await userEvent.click(screen.container.querySelector("[data-slot=sidebar-rail]")!)
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
    })

    it("collapsible icon folds it to icons", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ defaultOpen: false }} />)
      await expect.element(sidebar()).toHaveAttribute("data-collapsible", "icon")
    })

    it("collapsible offcanvas slides it away", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ defaultOpen: false }} sidebar={{ collapsible: "offcanvas" }} />)
      await expect.element(sidebar()).toHaveAttribute("data-collapsible", "offcanvas")
    })

    it("with a storage key, it starts as it was left", async () => {
      await page.viewport(1280, 800)
      window.localStorage.setItem("test-sidebar", "collapsed")
      await render(<AppFrame provider={{ storageKey: "test-sidebar" }} />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
      window.localStorage.removeItem("test-sidebar")
    })

    it("with a storage key, a toggle is remembered", async () => {
      await page.viewport(1280, 800)
      window.localStorage.removeItem("test-sidebar-toggle")
      await render(<AppFrame provider={{ storageKey: "test-sidebar-toggle" }} />)
      await userEvent.click(trigger())
      expect(window.localStorage.getItem("test-sidebar-toggle")).toBe("collapsed")
      window.localStorage.removeItem("test-sidebar-toggle")
    })

    it("with the shortcut off, ⌘B leaves it", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ shortcut: false }} />)
      await expect.element(sidebar()).toHaveAttribute("data-state", "expanded")
      // Had ⌘B toggled it, the trigger's press would expand it again.
      await userEvent.keyboard("{Meta>}b{/Meta}")
      await userEvent.click(trigger())
      await expect.element(sidebar()).toHaveAttribute("data-state", "collapsed")
    })

    it("label names it", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame sidebar={{ label: "Main" }} />)
      await expect.element(page.getByRole("complementary", { name: "Main" })).toBeInTheDocument()
    })

    it("a collapsed row shows its tooltip on hover", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame provider={{ defaultOpen: false }} />)
      await userEvent.hover(page.getByRole("button", { name: "Agents" }))
      // The row's own label, then the tooltip's.
      await expect.element(page.getByText("Agents", { exact: true }).nth(1)).toBeVisible()
    })
  })

  describe("menu button", () => {
    it("the active row is the current page", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await expect.element(page.getByRole("button", { name: "Agents" })).toHaveAttribute("aria-current", "page")
    })

    it("another row isn't the current page", async () => {
      await page.viewport(1280, 800)
      await render(<AppFrame />)
      await expect.element(page.getByRole("button", { name: "Activity" })).not.toHaveAttribute("aria-current")
    })
  })

  describe("on phones", () => {
    it("starts hidden", async () => {
      await page.viewport(390, 800)
      await render(<AppFrame />)
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
      await expect.element(page.getByRole("complementary")).not.toBeInTheDocument()
    })

    it("its trigger opens it as a sheet named by its label", async () => {
      await page.viewport(390, 800)
      await render(<AppFrame />)
      await userEvent.click(trigger())
      await expect.element(page.getByRole("dialog", { name: "App navigation" })).toBeVisible()
    })

    it("its trigger reports the sheet open", async () => {
      await page.viewport(390, 800)
      await render(<AppFrame />)
      await userEvent.click(trigger())
      // The open sheet is modal, so the trigger behind it is hidden from the accessibility tree.
      await expect.element(page.getByRole("button", { name: "Toggle sidebar", includeHidden: true }))
        .toHaveAttribute("aria-expanded", "true")
    })

    it("following a row closes the sheet", async () => {
      await page.viewport(390, 800)
      await render(<AppFrame />)
      await userEvent.click(trigger())
      await expect.element(page.getByRole("dialog", { name: "App navigation" })).toBeVisible()
      const row = page.getByRole("button", { name: "Activity" }).element() as HTMLButtonElement

      // Base UI's inert overlay takes a pointer click in the test iframe (and an outside press closes the sheet
      // anyway), so the row gets the click itself.
      row.click()

      await expect.element(page.getByRole("dialog", { name: "App navigation" })).not.toBeInTheDocument()
    })

    it("⌘B opens the sheet", async () => {
      await page.viewport(390, 800)
      await render(<AppFrame />)
      await expect.element(trigger()).toBeInTheDocument()
      await userEvent.keyboard("{Meta>}b{/Meta}")
      await expect.element(page.getByRole("dialog", { name: "App navigation" })).toBeVisible()
    })
  })
})
