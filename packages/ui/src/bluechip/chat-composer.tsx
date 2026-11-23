import { type FormEvent, type KeyboardEvent, useId, useRef, useState } from "react"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

const NO_SUGGESTIONS: ReadonlyArray<string> = []

export interface ChatComposerProps {
  /** Called with the trimmed message. The box clears after sending. */
  readonly onSend: (message: string) => void
  /** While bluechip answers, sending is blocked; with `onStop` the send button becomes Stop. */
  readonly sending?: boolean
  readonly onStop?: () => void
  /** Prompts shown above the box. Picking one fills the box for you to edit or send. */
  readonly suggestions?: ReadonlyArray<string>
  readonly placeholder?: string
  readonly className?: string
}

/**
 * Where you ask a question or describe the agent you want. The box grows to six lines, Enter sends and
 * Shift+Enter adds a line. No attachments, by design.
 */
export function ChatComposer({
  onSend,
  sending = false,
  onStop,
  suggestions = NO_SUGGESTIONS,
  placeholder = "Ask anything, or describe the agent you want…",
  className
}: ChatComposerProps) {
  const id = useId()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [message, setMessage] = useState("")
  const empty = message.trim() === ""

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (empty || sending) return
    onSend(message.trim())
    setMessage("")
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <div data-slot="chat-composer" className={cn("grid gap-2.5", className)}>
      {suggestions.length > 0 && (
        <fieldset>
          <legend className="sr-only">Suggestions</legend>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setMessage(suggestion)
                  textarea.current?.focus()
                }}
                className="cursor-pointer rounded-full bg-[linear-gradient(180deg,#fff,#f7f8fa)] px-[11px] py-1.5 text-left text-label-sm font-medium text-g-700 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08),0_1px_2px_rgba(10,11,13,.05)] transition-[box-shadow,color] duration-fast ease-brand hover:text-ink hover:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(0,0,255,.3),0_2px_6px_-2px_rgba(0,0,255,.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <form
        onSubmit={submit}
        className="rounded-[16px] bg-[linear-gradient(180deg,#fff,#fafbfc)] p-1.5 shadow-[0_0_0_1px_rgba(10,11,13,.09),0_2px_4px_rgba(10,11,13,.04),0_12px_28px_-12px_rgba(0,0,255,.2)] transition-shadow duration-base ease-brand focus-within:shadow-[0_0_0_1px_rgba(0,0,255,.55),0_0_0_4px_rgba(0,0,255,.1),0_12px_28px_-12px_rgba(0,0,255,.3)]"
      >
        <label htmlFor={id} className="sr-only">Message bluechip</label>
        <textarea
          ref={textarea}
          id={id}
          rows={1}
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={sending ? "bluechip is answering…" : placeholder}
          aria-describedby={`${id}-hint`}
          className="block max-h-[148px] min-h-[38px] w-full resize-none border-0 bg-transparent px-2.5 pt-2.5 pb-1.5 font-sans text-[15px] leading-[22px] text-ink outline-none field-sizing-content placeholder:text-g-400"
        />
        <div className="flex items-center justify-between gap-2 py-0.5 pr-0.5 pl-2.5">
          <span id={`${id}-hint`} className="text-label-sm text-g-500 max-sm:sr-only">
            Enter to send · Shift + Enter for a new line
          </span>
          {sending && onStop ?
            (
              <Button type="button" variant="secondary" size="icon-sm" aria-label="Stop" onClick={onStop}>
                <Icon name="stop" size={16} />
              </Button>
            ) :
            (
              <Button type="submit" size="icon-sm" aria-label="Send" disabled={empty || sending} className="ml-auto">
                <Icon name="arrow-up" size={16} />
              </Button>
            )}
        </div>
      </form>
    </div>
  )
}
