import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "../../shell/LegalPage.tsx"

export const Route = createFileRoute("/legal/terms")({ component: Terms })

function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      updated="25 November 2026"
      intro="These are preview terms for bluechip's early access. Reviewed terms will replace them before bluechip opens to everyone, and we will tell you when they do."
      sections={[
        [
          "What bluechip is",
          "bluechip is software. It sets up a smart account on Base that only your passkey controls, and lets you create agents that trade tokenized stocks inside limits you approve. bluechip never holds your money."
        ],
        [
          "Who can use it",
          "You must be an adult, live outside the United States and not be a US person, and be allowed to hold tokenized stocks where you live. You confirm this when you sign up."
        ],
        [
          "Your account and passkey",
          "You are responsible for your passkey and the devices that hold it. Anyone who can use your passkey can act as you. Tell us if you think it was compromised."
        ],
        [
          "Agents and limits",
          "You choose what each agent may do and lock it with Face ID. Agents act on their own inside those limits. You are responsible for the limits you set and the trades agents make within them."
        ],
        [
          "No advice",
          "bluechip, its chat and its agents give information, not investment, tax or legal advice. Make your own decisions."
        ],
        [
          "Fees",
          "During early access bluechip pays the network fees for your transactions. Pools charge their own trading fees, which are shown before a trade."
        ],
        [
          "Availability and changes",
          "Early access may change, pause or stop. You can always move your money out of your account with your passkey, even if bluechip itself is unavailable."
        ],
        [
          "Risks",
          "Read the risk disclosure before you add cash. Using bluechip means you accept those risks."
        ]
      ]}
    />
  )
}
