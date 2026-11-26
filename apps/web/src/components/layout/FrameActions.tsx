import { createContext, type ReactNode, useContext } from "react"

/** What the app frame puts in every page's top bar, after the page's own actions (the notifications bell). */
const FrameActionsContext = createContext<ReactNode>(null)

export const FrameActionsProvider = FrameActionsContext.Provider

/** The frame's actions for the top bar. */
export const useFrameActions = (): ReactNode => useContext(FrameActionsContext)
