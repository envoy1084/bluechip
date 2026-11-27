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
          "Stock prices go down as well as up. You can lose some or all of what you put in. Nothing on bluechip is a promise of returns, and nothing bluechip or its agents say is investment advice."
        ],
        [
          "A tokenized stock is not the share",
          "Coinbase's tokenized stocks are tokens issued by Coinbase that track a company's share, including dividends and splits through a multiplier. They are not the shares themselves, and their terms are set by Coinbase, not by bluechip."
        ],
        [
          "Prices and market hours",
          "Reference prices come from Chainlink and update during US market hours. On weekends and holidays they hold the last close, while the onchain pools keep trading, so the price you trade at can differ from the reference price."
        ],
        [
          "Trading onchain",
          "Trades are swaps in Aerodrome pools on Base. A large trade or a thin pool moves the price against you (slippage). bluechip checks each trade against the reference price, but cannot remove this risk."
        ],
        [
          "Agents act on their own",
          "An agent trades without asking you, inside the limits you lock with Face ID. Limits cap what it can do; they do not make its trades good ones. An agent can lose money while staying inside every limit."
        ],
        [
          "Smart contracts can fail",
          "Your account is a Kernel smart account. Agent limits are enforced by Namera v2, a release candidate that has had internal reviews but no external audit yet. A bug in any contract bluechip uses could lose funds."
        ],
        [
          "Your passkey is your key",
          "Only your passkey can move money out of your account. If you lose every device that holds it, you lose access until you add a recovery passkey. Passkeys synced by iCloud Keychain or Google Password Manager are safer."
        ],
        [
          "Who can use bluechip",
          "Tokenized US stocks are not offered to people in the United States, so bluechip is not available to them. bluechip is not affiliated with Coinbase, Base or any token named BLUECHIP."
        ]
      ]}
    />
  )
}
