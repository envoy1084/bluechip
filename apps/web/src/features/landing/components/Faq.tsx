import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@bluechip/ui/components/accordion"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

const QUESTIONS: ReadonlyArray<readonly [string, string]> = [
  [
    "Can an agent take my money?",
    "No. An agent can only trade the stocks you allow, inside its limits, and Base checks every trade it sends. It can never send money out of your account or change its own limits; changing them takes your Face ID."
  ],
  [
    "What are tokenized stocks?",
    "Coinbase's tokens on Base that track US stocks like Apple and Nvidia. bluechip prices each one with Chainlink's feed for it and trades it against USDC, your cash, on Aerodrome."
  ],
  [
    "What happens when the market is closed?",
    "Chainlink's prices pause on weekends and holidays. Agents set not to trade on paused prices wait until they move again; the others trade with a tighter price limit."
  ],
  [
    "What if I lose my phone?",
    "Passkeys synced by your phone's keychain work on your other devices. If you lose every one, your recovery key can recover the account on a new device after a 48-hour wait that you can cancel."
  ],
  [
    "Who pays for gas?",
    "Every trade on Base costs a little gas. Unless bluechip pays it for you, it's paid in ETH from your account, and each agent has a gas budget for the day."
  ],
  [
    "Who can use bluechip?",
    "People outside the United States. Coinbase's tokenized stocks aren't offered to people in the US, so bluechip isn't either."
  ],
  [
    "Is this financial advice?",
    "No. Agents act only on the instructions and limits you set. Prices go down as well as up, and you decide what your agents may do."
  ]
]

/** Short answers to what people ask first. */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="landing-faq" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] items-start gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <SectionIntro kicker="Questions" title={<span id="landing-faq">Good to know</span>}>
          Something else? The assistant answers from bluechip's help articles once you're in.
        </SectionIntro>
        <Reveal delay={100}>
          <Accordion defaultValue={QUESTIONS.slice(0, 1).map(([question]) => question)} className="shadow-e2">
            {QUESTIONS.map(([question, answer]) => (
              <AccordionItem key={question} value={question}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent>{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}
