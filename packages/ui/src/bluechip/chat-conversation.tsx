import type { ReactNode } from "react"
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export interface ChatConversationProps {
  readonly children: ReactNode
  readonly className?: string
  /** The accessible name of the message log. */
  readonly label?: string
}

/**
 * The scrolling message log, on `use-stick-to-bottom` (as in AI Elements): it follows a streaming answer while you are
 * at the bottom, lets you scroll up to read without being pulled back, and springs back once you return. Its parts
 * are `ChatConversationContent` and `ChatScrollButton`.
 */
export function ChatConversation({ children, className, label = "Conversation" }: ChatConversationProps) {
  return (
    <StickToBottom
      data-slot="chat-conversation"
      role="log"
      aria-label={label}
      initial="instant"
      resize="smooth"
      className={cn("relative min-h-0 flex-1 overflow-y-hidden", className)}
    >
      {children}
    </StickToBottom>
  )
}

/** The log's content: give it the column's width and padding. */
export function ChatConversationContent(
  { children, className }: Readonly<{ children: ReactNode; className?: string }>
) {
  return (
    <StickToBottom.Content data-slot="chat-conversation-content" className={className}>
      {children}
    </StickToBottom.Content>
  )
}

/** Shown once you've scrolled up from the latest message; takes you back down. */
export function ChatScrollButton({ className }: Readonly<{ className?: string }>) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  if (isAtBottom) return null
  return (
    <Button
      data-slot="chat-scroll-button"
      variant="secondary"
      size="icon-sm"
      aria-label="Scroll to the latest message"
      onClick={() => void scrollToBottom()}
      className={cn(
        "absolute bottom-3 left-1/2 z-[5] -translate-x-1/2 animate-fade-in rounded-full shadow-e3",
        className
      )}
    >
      <Icon name="arrow-down" size={16} />
    </Button>
  )
}
