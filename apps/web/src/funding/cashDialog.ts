import * as Atom from "effect/reactivity/Atom"

/** Which cash dialog is open: adding cash, withdrawing it, or neither. Any page can open one. */
export const cashDialogAtom = Atom.make<"add" | "withdraw" | null>(null)
