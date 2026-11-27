import { LogoMark } from "@bluechip/ui/bluechip/logo"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { ChatDemo } from "./ChatDemo.tsx"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

const POINTS: ReadonlyArray<{ readonly art: IllustrationName; readonly text: string }> = [
  { art: "chat", text: "Drafts agents, automations and trades for you to review" },
  { art: "notebook", text: "Remembers what you tell it. You can delete any memory" },
  { art: "passkey", text: "Nothing is signed in a chat. Money moves only with Face ID" }
]

/** The assistant: a chat that plays out, and the same bluechip in Telegram with its notifications. */
export function Assistant() {
  return (
    <section
      id="assistant"
      aria-labelledby="landing-assistant"
      className="scroll-mt-20 overflow-hidden bg-white px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="grid gap-8">
          <SectionIntro
            kicker="Assistant"
            title={<span id="landing-assistant">Say what you want, in plain words</span>}
          >
            In the app or in Telegram.
          </SectionIntro>
          <ul className="grid gap-3.5">
            {POINTS.map((point, index) => (
              <Reveal as="li" key={point.text} delay={index * 90} className="flex items-start gap-3.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] shadow-[inset_0_0_0_1px_var(--color-info-line)]">
                  <Illustration name={point.art} size={28} aria-hidden />
                </span>
                <span className="pt-2.5 text-body text-g-700">{point.text}</span>
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="relative">
          <Reveal>
            <ChatDemo />
          </Reveal>
          <Reveal
            delay={250}
            className="relative mt-4 sm:absolute sm:-bottom-8 sm:-left-10 sm:mt-0 sm:w-[300px] lg:-left-16"
          >
            <div aria-hidden className="grid gap-2.5 rounded-xl bg-[#eef3f8] p-3 shadow-e4">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-white shadow-hair">
                  <LogoMark size={15} />
                </span>
                <b className="text-label font-semibold">bluechip in Telegram</b>
              </div>
              <div className="grid gap-2 rounded-[14px_14px_14px_4px] bg-white p-3 text-label text-g-800 shadow-hair">
                <p className="grid gap-0.5">
                  <b className="font-semibold">Tech picker needs your approval</b>{" "}
                  Buy $250 of Apple. Approve or decline it with Face ID.
                </p>
                <span className="rounded-md bg-g-50 py-1.5 text-center text-label-sm font-semibold text-blue">
                  Review
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
