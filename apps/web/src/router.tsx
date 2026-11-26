import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen.ts"

// An agent's page and its tabs (not its edit page, a page of its own): moving between them changes the tab alone.
const AGENT_TAB = /^\/agents\/(?!new\/?$)([^/]+)(?:\/(?:automations|journal|results|usage|history))?\/?$/

const agentOf = (pathname: string | undefined) => pathname === undefined ? undefined : AGENT_TAB.exec(pathname)?.[1]

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    // A new page crossfades (styles.css), an agent's new tab only its content; a change of search params alone, like a
    // filter, stays instant.
    defaultViewTransition: {
      types: ({ pathChanged, fromLocation, toLocation }) => {
        if (!pathChanged) return false
        const agent = agentOf(toLocation.pathname)
        return agent !== undefined && agent === agentOf(fromLocation?.pathname) ? ["agent-tab"] : ["page"]
      }
    }
  })
}
