import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@bluechip/ui/components/accordion"
import { QUESTIONS } from "../model/questions.ts"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

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
