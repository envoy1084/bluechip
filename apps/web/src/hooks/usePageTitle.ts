import { useEffect } from "react"
import { pageTitle } from "../lib/seo/head.ts"

/**
 * Names the tab after what the page shows once it has loaded ("Index fund | bluechip"), where the route's head only
 * knows the kind of page ("Agent | bluechip"). The route's title takes over again when you leave.
 */
export const usePageTitle = (name: string): void => {
  useEffect(() => {
    document.title = pageTitle(name)
  }, [name])
}
