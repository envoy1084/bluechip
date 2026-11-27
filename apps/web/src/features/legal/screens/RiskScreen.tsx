import { LegalPage } from "../components/LegalPage.tsx"
import { RISK } from "../model/documents.ts"

export function RiskScreen() {
  return (
    <LegalPage
      legal={RISK}
      intro="Investing can lose money, and doing it onchain with software agents adds risks of its own. Read this before you add cash."
      sections={[
        [
          "You can lose money",
          "Stock prices go down as well as up. You can lose some or all of what you put in. Nothing on bluechip is a promise of returns, and nothing bluechip, its assistant or its agents say is investment advice."
        ],
        [
          "Paper money isn't the real thing",
          "On paper money the dollars and stocks are test tokens with no value, its prices come from bluechip's own feeds and its trades from bluechip's test exchange. How an agent does there says little about how it would do with real money."
        ],
        [
          "A tokenized stock is not the share",
          "Coinbase's tokenized stocks are tokens issued by Coinbase that track a company's share, with splits and dividends followed through a multiplier. You don't own the share itself, its terms are Coinbase's, and what you hold depends on Coinbase keeping its promises and its tokens working."
        ],
        [
          "Your cash is USDC",
          "Your cash is USDC, a token issued by Circle that aims to be worth one dollar. It can lose that value, and Circle can freeze it."
        ],
        [
          "Prices and market hours",
          "Reference prices come from Chainlink and move from Sunday evening to Friday evening, New York time. On weekends and holidays they hold the last price while the pools keep trading, so the price you trade at can differ from the reference. A feed can also be late or wrong. On paper money, bluechip writes the prices itself from Alpaca's market data."
        ],
        [
          "Trading onchain",
          "Trades are swaps in Aerodrome pools on Base. Each pays the pool's fee, and a large trade or a thin pool moves the price against you (slippage). bluechip refuses trades too far from the reference price, but can't remove this risk, and a trade can fail and need trying again."
        ],
        [
          "Agents act on their own",
          "An agent trades without asking you, inside the rules you lock with Face ID. Rules cap what it can do; they don't make its trades good ones. An agent can lose money while staying inside every rule, and rules you set wrongly let it trade in ways you didn't mean."
        ],
        [
          "Automations and judgments",
          "An automation acts on triggers you set, and can fire on a sudden price move, an old price or a misleading story. A judgment is an AI model's reading of a news story, and it can be wrong. Trades on news ask you first unless you let them go ahead."
        ],
        [
          "The assistant can be wrong",
          "The assistant uses AI models. It can misunderstand you, get facts wrong or find wrong information on the web. Read every trade, agent and automation it proposes before you confirm it."
        ],
        [
          "Smart contracts can fail",
          "Your account is a Kernel smart account. Agents' rules are enforced by Namera v2 and by bluechip's own policy contracts, which have had internal reviews but no external audit yet. Trades also rely on Aerodrome's, Chainlink's, Coinbase's and Circle's contracts. A bug in any of them could lose funds."
        ],
        [
          "Bundlers and gas",
          "Your account's operations reach Base through Alchemy's bundler, and bluechip pays their gas today through Alchemy. If either stops working, trades wait or fail, and gas may have to be paid in ETH from your account."
        ],
        [
          "Outages",
          "bluechip, Base or a service it relies on (Alchemy, Alpaca, Anthropic) can be slow or down. Then trades, automations and approvals can wait or fail, and prices on the screen can be out of date. Your money stays in your account, but you may not be able to trade or withdraw through bluechip until it's back."
        ],
        [
          "Your passkey is your key",
          "Only your passkeys can move money out of your account. If you lose every one and have no recovery key, you lose access to your account and what's in it. A recovery takes 48 hours, and anyone holding your recovery key can take over your account after 48 hours unless you cancel, so keep it safe and read what bluechip tells you."
        ],
        [
          "Who can use bluechip",
          "Tokenized US stocks are not offered to US citizens or residents, so bluechip is not available to them. bluechip is not affiliated with Coinbase, Base or any token named BLUECHIP."
        ]
      ]}
    />
  )
}
