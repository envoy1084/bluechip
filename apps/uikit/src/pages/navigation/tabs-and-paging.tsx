import { Badge } from "@bluechip/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@bluechip/ui/components/breadcrumb"
import { Button } from "@bluechip/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@bluechip/ui/components/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  paginationRange
} from "@bluechip/ui/components/pagination"
import { Tabs, TabsCount, TabsList, TabsPanel, TabsTab } from "@bluechip/ui/components/tabs"
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { LIMITS } from "./data.ts"
import { Limits, Section } from "./layout.tsx"

function PaginationDemo() {
  const total = 12
  const [page, setPage] = useState(3)
  return (
    <div className="grid gap-5">
      <Pagination aria-label="Activity pages">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled={page === 1} onClick={() => setPage(page - 1)} />
          </PaginationItem>
          {paginationRange(page, total).map((entry, i) => (
            <PaginationItem key={entry === "ellipsis" ? `gap-${i}` : entry}>
              {entry === "ellipsis" ?
                <PaginationEllipsis /> :
                (
                  <PaginationLink
                    isActive={entry === page}
                    aria-label={`Page ${entry}`}
                    onClick={() => setPage(entry)}
                  >
                    {entry}
                  </PaginationLink>
                )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext disabled={page === total} onClick={() => setPage(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <nav aria-label="Trades pages, compact" className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-label text-g-500 tabular-nums">Showing 21–30 of 118</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Icon name="chevron-left" size={16} />Previous
          </Button>
          <Button variant="secondary" size="sm">
            Next<Icon name="chevron-right" size={16} />
          </Button>
        </div>
      </nav>
    </div>
  )
}

export function TabsSection() {
  return (
    <Section
      id="tabs"
      title="Tabs"
      base="Tabs"
      purpose="Switch between views of the same thing. Arrow keys move, Home and End jump."
    >
      <Tabs defaultValue="overview">
        <TabsList aria-label="Agent">
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="activity">
            Activity<TabsCount>12</TabsCount>
          </TabsTab>
          <TabsTab value="limits">Limits</TabsTab>
          <TabsTab value="taxes" disabled>Taxes</TabsTab>
        </TabsList>
        <TabsPanel value="overview">
          Rebalancer checks your mix every Monday and trades only when a stock drifts more than 5% from its target.
        </TabsPanel>
        <TabsPanel value="activity">
          <ul className="grid gap-2.5">
            <li className="flex items-center gap-2.5">
              <Badge variant="secondary">TSLA</Badge>Sold 1 share<span className="ml-auto text-label text-g-500">
                Mon 9:02
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Badge variant="secondary">NVDA</Badge>Bought 0.6 shares
              <span className="ml-auto text-label text-g-500">Mon 9:02</span>
            </li>
          </ul>
        </TabsPanel>
        <TabsPanel value="limits">
          <Limits rows={LIMITS.slice(0, 4)} />
        </TabsPanel>
        <TabsPanel value="taxes" />
      </Tabs>
      <Tabs defaultValue="stocks" variant="segmented">
        <TabsList aria-label="Holdings">
          <TabsTab value="stocks">Stocks</TabsTab>
          <TabsTab value="cash">Cash</TabsTab>
          <TabsTab value="agents">Agents</TabsTab>
        </TabsList>
        <TabsPanel value="stocks">
          6 stocks worth <b className="tabular-nums">$9,212.40</b>
        </TabsPanel>
        <TabsPanel value="cash">
          <b className="tabular-nums">1,240.50 USDC</b> ready to use.
        </TabsPanel>
        <TabsPanel value="agents">3 agents running, 1 paused.</TabsPanel>
      </Tabs>
    </Section>
  )
}

export function BreadcrumbSection() {
  return (
    <Section
      id="breadcrumb"
      title="Breadcrumb"
      base="Breadcrumb"
      purpose="Where you are and how you got there. Middle steps fold into a menu when space is tight."
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#breadcrumb" aria-label="Home">
              <Icon name="home" size={14} />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#breadcrumb">Agents</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#breadcrumb">Rebalancer</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Limits</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Breadcrumb aria-label="Breadcrumb, collapsed">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#breadcrumb">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Show 2 more"
                className="grid h-6 w-[26px] cursor-pointer place-items-center rounded-[6px] text-g-500 hover:bg-g-100 hover:text-ink data-popup-open:bg-g-100"
              >
                <Icon name="more" size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => toast("Going to Activity")}>
                  <Icon name="activity" />Activity
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast("Going to 2026")}>
                  <Icon name="calendar" />2026
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#breadcrumb">November</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Trade #2841</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </Section>
  )
}

export function PaginationSection() {
  return (
    <Section
      id="pagination"
      title="Pagination"
      base="Pagination"
      purpose="Move through long lists a page at a time. The current page is marked for screen readers too."
    >
      <PaginationDemo />
    </Section>
  )
}
