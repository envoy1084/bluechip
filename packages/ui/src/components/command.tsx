import { Autocomplete } from "@base-ui/react/autocomplete"
import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { overlayBackdropClassName } from "./dialog.tsx"
import { Kbd } from "./kbd.tsx"

export type CommandProps = Omit<ComponentProps<typeof Autocomplete.Root>, "open" | "inline"> & {
  readonly className?: string
}

/**
 * Search everything and jump: an always-open list filtered by the input. Pass `items` (flat, or groups of
 * `{ value, items }`) so filtering works, then render them through `CommandList` and `CommandCollection`.
 * Items run their `onClick` on click or Enter.
 */
export function Command(
  { className, children, autoHighlight = "always", keepHighlight = true, ...props }: CommandProps
) {
  return (
    <Autocomplete.Root open inline autoHighlight={autoHighlight} keepHighlight={keepHighlight} {...props}>
      <div data-slot="command" className={cn("flex min-h-0 flex-col overflow-hidden bg-white", className)}>
        {children}
      </div>
    </Autocomplete.Root>
  )
}

export interface CommandInputProps extends Autocomplete.Input.Props {
  /** A key hint shown at the end of the input, such as `esc`. */
  readonly hint?: ReactNode
}

export function CommandInput({ className, hint, ...props }: CommandInputProps) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-g-100 px-3.5"
    >
      <Icon name="search" className="text-g-400" />
      <Autocomplete.Input
        data-slot="command-input"
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-g-400",
          className
        )}
        {...props}
      />
      {hint != null && <Kbd>{hint}</Kbd>}
    </div>
  )
}

export function CommandList({ className, ...props }: Autocomplete.List.Props) {
  return (
    <Autocomplete.List
      data-slot="command-list"
      className={cn(
        "max-h-[min(380px,56vh)] scroll-py-2 overflow-y-auto overscroll-contain p-1.5 empty:hidden",
        className
      )}
      {...props}
    />
  )
}

/** Shown only when nothing matches the search. */
export function CommandEmpty({ className, ...props }: Autocomplete.Empty.Props) {
  return (
    <Autocomplete.Empty
      data-slot="command-empty"
      className={cn(
        "grid justify-items-center gap-1 px-4 py-9 text-center text-body-sm text-g-700 empty:hidden",
        className
      )}
      {...props}
    />
  )
}

export function CommandGroup(props: Autocomplete.Group.Props) {
  return <Autocomplete.Group data-slot="command-group" {...props} />
}

export function CommandGroupLabel({ className, ...props }: Autocomplete.GroupLabel.Props) {
  return (
    <Autocomplete.GroupLabel
      data-slot="command-group-label"
      className={cn("px-2 pt-2 pb-1 text-caption font-semibold text-g-400", className)}
      {...props}
    />
  )
}

export function CommandCollection(props: Autocomplete.Collection.Props) {
  return <Autocomplete.Collection {...props} />
}

export function CommandItem({ className, onClick, ...props }: Autocomplete.Item.Props) {
  const dialog = useContext(CommandDialogContext)
  return (
    <Autocomplete.Item
      data-slot="command-item"
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-body-sm text-g-800 outline-none select-none",
        "data-highlighted:bg-g-100 data-highlighted:text-ink data-highlighted:shadow-[inset_2px_0_0_var(--color-blue)]",
        "data-disabled:opacity-45 [&>svg]:shrink-0 [&>svg]:text-g-500 data-highlighted:[&>svg]:text-blue",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        dialog?.close()
      }}
      {...props}
    />
  )
}

export function CommandShortcut({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="command-shortcut"
      className={cn("ml-auto pl-4 font-sans text-caption tracking-[.04em] text-g-400", className)}
      {...props}
    />
  )
}

/** The hint bar under the list: `<CommandFooter><CommandKey>↵</CommandKey>Open</CommandFooter>`. */
export function CommandFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="command-footer"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-3.5 border-t border-g-100 bg-g-50 px-3.5 py-[9px] text-caption text-g-500",
        "[&>span]:inline-flex [&>span]:items-center [&>span]:gap-[5px]",
        className
      )}
      {...props}
    />
  )
}

export function CommandKey({ className, ...props }: ComponentProps<"kbd">) {
  return <Kbd data-slot="command-key" className={cn("h-[18px] min-w-[18px] text-caption-sm", className)} {...props} />
}

const CommandDialogContext = createContext<{ readonly close: () => void } | null>(null)

export interface CommandDialogProps {
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /** The letter that opens and closes the palette with ⌘ or Ctrl, anywhere on the page. `false` turns it off. */
  readonly hotkey?: string | false
  readonly children?: ReactNode
}

/** The command palette as a modal. ⌘K (or Ctrl+K) toggles it; choosing an item closes it. */
export function CommandDialog(
  { open: openProp, defaultOpen = false, onOpenChange, hotkey = "k", children }: CommandDialogProps
) {
  const [openState, setOpenState] = useState(defaultOpen)
  const open = openProp ?? openState
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }, [onOpenChange])

  useEffect(() => {
    if (hotkey === false) return
    const toggle = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== hotkey) return
      event.preventDefault()
      setOpen(!open)
    }
    window.addEventListener("keydown", toggle)
    return () => window.removeEventListener("keydown", toggle)
  }, [hotkey, open, setOpen])

  const context = useMemo(() => ({ close: () => setOpen(false) }), [setOpen])
  return (
    <CommandDialogContext value={context}>
      <BaseDialog.Root open={open} onOpenChange={setOpen}>
        {children}
      </BaseDialog.Root>
    </CommandDialogContext>
  )
}

export function CommandDialogTrigger(props: BaseDialog.Trigger.Props) {
  return <BaseDialog.Trigger data-slot="command-dialog-trigger" {...props} />
}

export interface CommandDialogContentProps extends BaseDialog.Popup.Props {
  /** The dialog's accessible name. */
  readonly title?: string
}

export function CommandDialogContent(
  { className, title = "Search bluechip", children, ...props }: CommandDialogContentProps
) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop data-slot="command-dialog-backdrop" className={overlayBackdropClassName} />
      <BaseDialog.Viewport className="fixed inset-0 flex justify-center px-3 pt-[14vh]">
        <BaseDialog.Popup
          data-slot="command-dialog-content"
          className={cn(
            "flex h-fit max-h-[80dvh] w-full max-w-[580px] flex-col overflow-hidden rounded-xl bg-white shadow-e4 outline-none",
            "transition-[opacity,scale] duration-base ease-brand",
            "data-starting-style:scale-97 data-starting-style:opacity-0",
            "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-fast data-ending-style:ease-brand-in",
            className
          )}
          {...props}
        >
          <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  )
}
