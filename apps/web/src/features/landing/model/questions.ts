/** The landing's questions and answers: its FAQ, and the FAQ search engines read (`structuredData.ts`). */
export const QUESTIONS: ReadonlyArray<readonly [string, string]> = [
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
