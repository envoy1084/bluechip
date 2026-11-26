// The automation cards: one drafted (or changed) from your words, saved when you confirm; one paused or resumed.
import type { Card } from "@bluechip/domain/assistant/Card"
import type { AutomationId } from "@bluechip/domain/Ids"
import {
  ChatCard,
  ChatCardAnswer,
  ChatCardHeadline,
  ChatCardNote,
  ChatCardProblem
} from "@bluechip/ui/bluechip/chat-card"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { useCardAnswer } from "../../hooks/useCardAnswer.ts"

type OnCard = (card: Card) => void

const STATE = {
  pending: { label: "Waiting for you", tone: "waiting" },
  applied: { label: "Done", tone: "done" },
  dismissed: { label: "Dismissed", tone: "quiet" }
} as const

// Its settings in one sentence: "At most once every 4 hours, up to 3 times, until 26 Dec 2026."
const settingsSentence = (settings: ReadonlyArray<string>): string =>
  `${
    settings.map((setting, index) => index === 0 ? setting : `${setting.charAt(0).toLowerCase()}${setting.slice(1)}`)
      .join(", ")
  }.`

/** The way to an automation once it's saved. */
function SeeIt({ id }: Readonly<{ id: AutomationId | undefined }>) {
  if (id === undefined) return null
  return (
    <ButtonLink
      variant="secondary"
      render={<Link to="/automations/$automationId" params={{ automationId: id }} />}
    >
      See it<Icon name="arrow-right" size={16} />
    </ButtonLink>
  )
}

/**
 * An automation read back in a sentence before you save it, with its settings: nothing runs until you confirm. Once
 * saved, the end state says it's on and links to it.
 */
export function AutomationCard(
  { card, onCard }: Readonly<{ card: Extract<Card, { _tag: "Automation" }>; onCard: OnCard }>
) {
  const answer = useCardAnswer(card, onCard)
  const creating = card.action === "create"
  const state = STATE[card.status]
  const name = card.automation?.name ?? card.draft.name

  return (
    <ChatCard
      tag={creating ? "New automation" : "Automation change"}
      icon="zap"
      state={state.label}
      tone={state.tone}
      footer={card.status === "pending" ?
        (
          <ChatCardAnswer
            busy={answer.busy}
            confirmLabel={creating ? "Save automation" : "Save changes"}
            onConfirm={answer.confirm}
            onDismiss={answer.dismiss}
          />
        ) :
        undefined}
    >
      {card.status === "applied" ?
        (
          <Outcome
            tone="success"
            title={creating ? `${name} is on` : `${name} is changed`}
            description={card.description.sentence}
            actions={<SeeIt id={card.automation?.id} />}
          />
        ) :
        (
          <>
            <ChatCardHeadline
              title={name}
              detail={card.status === "dismissed" ? "You left it as it was. Nothing was saved." : undefined}
            />
            <p className="rounded-[12px] px-3 py-2.5 text-[14px] leading-snug text-g-800 surface-well">
              {card.description.sentence}
            </p>
            {card.description.settings.length === 0 ?
              null :
              <ChatCardNote icon="clock">{settingsSentence(card.description.settings)}</ChatCardNote>}
            {card.status === "pending" ?
              (
                <ChatCardNote icon="shield">
                  Nothing runs until you save it. Every trade it makes still goes through its agent's rules.
                </ChatCardNote>
              ) :
              null}
          </>
        )}
      <ChatCardProblem>{answer.problem}</ChatCardProblem>
    </ChatCard>
  )
}

/** Pausing or resuming an automation, asked in chat: done in place once you confirm. */
export function AutomationControlCard(
  { card, onCard }: Readonly<{ card: Extract<Card, { _tag: "AutomationControl" }>; onCard: OnCard }>
) {
  const answer = useCardAnswer(card, onCard)
  const resume = card.action === "resume"
  const state = STATE[card.status]
  const name = card.automationName

  return (
    <ChatCard
      tag={resume ? "Resume" : "Pause"}
      icon={resume ? "play" : "pause"}
      state={state.label}
      tone={state.tone}
      footer={card.status === "pending" ?
        (
          <ChatCardAnswer
            busy={answer.busy}
            confirmLabel={resume ? `Resume ${name}` : `Pause ${name}`}
            onConfirm={answer.confirm}
            onDismiss={answer.dismiss}
          />
        ) :
        undefined}
    >
      {card.status === "applied" ?
        (
          <Outcome
            tone="success"
            title={resume ? `${name} is running again` : `${name} is paused`}
            description={resume ? "It runs again from now." : "It won't run until you resume it."}
            actions={<SeeIt id={card.automationId} />}
          />
        ) :
        (
          <ChatCardHeadline
            title={resume ? `Resume ${name}` : `Pause ${name}`}
            detail={card.status === "dismissed" ?
              "You left it as it was." :
              resume ?
              "It runs again from now." :
              "It stops running until you resume it. Nothing is sold."}
          />
        )}
      <ChatCardProblem>{answer.problem}</ChatCardProblem>
    </ChatCard>
  )
}
