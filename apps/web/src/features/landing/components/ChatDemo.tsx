import { AgentDraftCard } from "@bluechip/ui/bluechip/agent-draft-card"
import { LogoMark } from "@bluechip/ui/bluechip/logo"
import { Icon } from "@bluechip/ui/icons/icon"
import { useReducedMotion } from "@bluechip/ui/motion/use-reduced-motion"
import { useEffect, useRef, useState } from "react"
import { useInView } from "../hooks/useInView.ts"

const ASK = "Buy $50 of Microsoft every Monday"
const ANSWER =
  "I can set that up as a Weekly buyer: $50 of Microsoft every Monday, and never more than $50 in a day. Here are its limits. Nothing runs until you lock them with Face ID."
const WORDS = ANSWER.split(" ")

// When each part arrives, in ms after the chat comes into view; the answer streams in between.
const ASKED_AT = 300
const TYPING_AT = 900
const ANSWER_AT = 1900
const WORD_MS = 45
const CARD_AT = ANSWER_AT + WORDS.length * WORD_MS + 250

/**
 * A chat that plays once when it comes into view: you ask, bluechip types, answers word by word and hands you a
 * draft agent to lock. Decorative; the section's words say the same. Under reduced motion it is already finished.
 */
export function ChatDemo() {
  const root = useRef<HTMLDivElement>(null)
  const seen = useInView(root)
  const reduced = useReducedMotion()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!seen || reduced) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const ms = now - start
      // Quantized so a frame between two words renders nothing new; the last frame lands exactly on the card.
      setElapsed(ms >= CARD_AT ? CARD_AT : Math.floor(ms / WORD_MS) * WORD_MS)
      if (ms < CARD_AT) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [seen, reduced])

  const at = reduced ? CARD_AT : elapsed
  const words = Math.max(0, Math.min(WORDS.length, Math.floor((at - ANSWER_AT) / WORD_MS)))

  return (
    <div
      ref={root}
      aria-hidden
      className="grid min-h-[520px] content-start gap-4 rounded-2xl bg-white p-4 shadow-e4 sm:p-6"
    >
      <div className="flex items-center gap-2 border-b border-g-100 pb-3">
        <LogoMark size={18} />
        <b className="text-body-sm font-semibold">Chat</b>
        <span className="ml-auto text-caption text-g-500">bluechip</span>
      </div>

      {at >= ASKED_AT && (
        <div className="flex animate-slide-up justify-end pl-[18%] motion-reduce:animate-none">
          <p className="rounded-[16px_16px_4px_16px] bg-[linear-gradient(180deg,#f1f3f7,#eceff4)] px-3.5 py-[9px] text-[14.5px]">
            {ASK}
          </p>
        </div>
      )}

      {at >= TYPING_AT && (
        <div className="flex gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(180deg,#fff,#f1f3f8)] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]">
            <LogoMark size={15} />
          </span>
          {words === 0 ?
            (
              <span className="inline-flex gap-1 py-2.5">
                {[0, 150, 300].map((delay) => (
                  <i
                    key={delay}
                    className="size-1.5 animate-pulse rounded-full bg-g-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            ) :
            <p className="pt-[3px] text-[14.5px] text-g-800">{WORDS.slice(0, words).join(" ")}</p>}
        </div>
      )}

      {at >= CARD_AT && (
        <div className="animate-slide-up pl-[38px] motion-reduce:animate-none">
          <AgentDraftCard
            agentId="Weekly buyer"
            name="Weekly buyer"
            detail="Buys Microsoft every Monday"
            can={["Buy Microsoft", "Spend up to $50 a day"]}
            never={["Send money out of your account", "Change its own limits"]}
            state="Not running yet"
            footer={
              <span className="surface-primary inline-flex h-[30px] items-center gap-1.5 rounded-sm px-[11px] text-label font-[550]">
                <Icon name="face-id" size={15} />Lock with Face ID
              </span>
            }
          />
        </div>
      )}
    </div>
  )
}
