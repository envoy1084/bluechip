import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen.ts"

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    // A new page crossfades (styles.css); a change of search params alone, like a filter, stays instant.
    defaultViewTransition: { types: ({ pathChanged }) => (pathChanged ? ["page"] : false) }
  })
}
