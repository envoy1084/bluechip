import { LegalPage } from "../components/LegalPage.tsx"
import { TERMS } from "../model/documents.ts"

export function TermsScreen() {
  return (
    <LegalPage
      legal={TERMS}
      intro="These are preview terms for bluechip's early access. Reviewed terms will replace them before bluechip opens to everyone, and we will tell you when they do. By creating an account you agree to them and to the risk disclosure."
      sections={[
        [
          "What bluechip is",
          "bluechip is software. It sets up a smart account on Base that only your passkeys control, lets you buy and sell tokenized US stocks with it, and lets you make agents and automations that trade for you inside rules you lock onchain. bluechip never holds your money, and it is not a broker, an exchange, a bank or an investment adviser."
        ],
        [
          "Paper money",
          "Paper money (paper.bluechip.markets) runs on Base Sepolia, a test network, with test USDC and test stocks. They have no value, can't be exchanged for anything or moved to Base, and are given out up to $10,000 a day per account. Paper money may be reset, changed or stopped at any time, and its accounts, balances and history with it."
        ],
        [
          "Real money",
          "bluechip (bluechip.markets) runs on Base with real USDC and Coinbase's tokenized stocks. Everything you do there moves real money, and trades on Base can't be undone."
        ],
        [
          "Who can use it",
          "You must be at least 18, not a US citizen or resident, and allowed to hold tokenized stocks where you live. You confirm this when you sign up. If it isn't true, you may not use bluechip, and we may close your access."
        ],
        [
          "Your account and passkeys",
          "Your account is a smart account on Base, and any one of its passkeys can sign for it. You are responsible for your passkeys and the devices that hold them: anyone who can use one can act as you. A recovery key can replace your passkeys 48 hours after it asks, unless you cancel. Tell us if you think a passkey was compromised."
        ],
        [
          "Tokenized stocks",
          "The stocks on bluechip are tokens issued by Coinbase that track US shares. Coinbase sets their terms, not bluechip, and bluechip is not affiliated with Coinbase. Trades are swaps in Aerodrome's pools on Base, priced against Chainlink's feed for each stock."
        ],
        [
          "Your trades",
          "You sign each of your own trades with your passkey. The quote shows the least you get; a trade that would fill for less fails, and nothing is traded. bluechip refuses a trade more than 1% worse than Chainlink's price (0.5% while prices are paused), or when Chainlink's price is too old."
        ],
        [
          "Agents",
          "You choose what each agent may do and lock its rules with Face ID; Base checks every trade it sends against them. Inside them an agent trades without asking you; a trade over its largest trade waits for your approval. A lock lasts 90 days. Pausing an agent stops bluechip sending its trades. You are responsible for the rules you set and for the trades agents make within them."
        ],
        [
          "Approvals and automations",
          "An automation runs when its trigger fires and its checks pass, and trades through one of your agents, within its rules, or asks for your Face ID for each trade. Trades on news ask you first unless you let them go ahead. An approval you don't answer expires after 6 hours, and nothing is sent."
        ],
        [
          "The assistant",
          "The assistant uses AI models and can be wrong. It can answer questions, search the web, and propose trades, agents and automations, but nothing changes until you confirm it, and anything outside an agent's rules needs your Face ID. Each account has a daily budget for it."
        ],
        [
          "No advice",
          "bluechip, its assistant, its agents and its automations give information, not investment, tax or legal advice. You make your own decisions, and you are responsible for any taxes on your trades."
        ],
        [
          "Fees",
          "bluechip charges no fee of its own today. Each trade pays the pool's fee and any slippage, shown with the trade and in your activity. bluechip pays the network's gas for your account today; if that changes, gas is paid in ETH from your account. We will tell you before bluechip charges anything."
        ],
        [
          "Market hours",
          "Prices follow the US stock market: they move from Sunday evening to Friday evening, New York time, and pause on weekends and market holidays. While they are paused, trades are held to a tighter price check, and agents set not to trade on paused prices wait."
        ],
        [
          "Using bluechip fairly",
          "Don't use bluechip to break the law, to attack it or other people's accounts, or to take more test money than paper money gives each account. We may limit or close access that does."
        ],
        [
          "Availability and changes",
          "Early access may change, pause or stop, and bluechip, Base or the services it uses can be unavailable. Your money stays in your account whatever happens to bluechip, but while bluechip is down you may not be able to trade or withdraw through it."
        ],
        [
          "Responsibility",
          "bluechip is provided as it is. As far as the law allows, we are not responsible for losses from market prices, from trades you or your agents make within your rules, from contracts or networks bluechip uses, or from services outside our control."
        ],
        [
          "Ending",
          "You can stop using bluechip at any time, and withdraw your cash first. We may suspend or close access that breaks these terms. Questions about these terms go to vedant@envoy1084.xyz."
        ]
      ]}
    />
  )
}
