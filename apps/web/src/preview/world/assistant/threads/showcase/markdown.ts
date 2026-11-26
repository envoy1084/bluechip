// "Long answers and formatting": every piece of markdown an answer can carry, so its typography can be reviewed:
// headings, paragraphs, nested lists, tables, code, a formula, quotes, links, emphasis and ticker chips.
import { say, type ThreadContext, type Turn } from "../../rounds.ts"

const GUIDE = `## How your agents decide

Every trade an agent proposes goes through the same steps, in order. Nothing here is a promise from bluechip: it's what
the chain itself checks, so a server that misbehaves still can't move your money outside the rules.

### 1. The policies, onchain

1. **Trade**: which stocks it may touch, and whether it buys, sells or both.
   - A *Weekly buyer* only buys.
   - A *Stop-loss guard* only sells.
     - It can sell part of a position, never more than you hold.
2. **Trade size**: the largest single trade, and the smallest worth sending.
3. **Stock cap** and **cash reserve**: no stock above its share, and cash never below yours.

### 2. The numbers it compares

| Check | Your setting | This trade | Passes |
| --- | ---: | ---: | :---: |
| Daily budget | $250 | $50 | yes |
| Largest trade | $100 | $50 | yes |
| Stock cap | 30% | 24.1% | yes |
| Cash reserve | 10% | 18.3% | yes |

The price it gets has to be close to Chainlink's. The gap, in basis points, is

$$
\\text{gap} = \\frac{p_{\\text{pool}} - p_{\\text{chainlink}}}{p_{\\text{chainlink}}} \\times 10{,}000
$$

and the trade is refused when it is over the collar (100 by default).

### 3. What you'd see in the code

A rule contract answers one question, \`check(account, moved)\`, and reverts when the answer is no:

\`\`\`solidity
function check(address account, Moved calldata moved) external pure {
    if (moved.stockShareBps > maxBps) revert StockCapExceeded(moved.stock);
}
\`\`\`

> Policies only ever narrow what an agent may do. Adding one makes it safer; removing one needs your Face ID.

That's why [[NVDA]] can be refused at 31% while [[AAPL]] at 29% goes through. ~~Agents can override this~~ They can't.
Read more in [How agents work](/help/agents#policies), or see [Chainlink's price feeds](https://data.chain.link).

---

*That's the long version.* The short one: **your rules, enforced by Base.**`

export const longAnswers = (_context: ThreadContext): ReadonlyArray<Turn> => [
  { you: "Explain in detail how an agent decides whether a trade goes through", rounds: [[say(GUIDE)]] },
  {
    you: "Now give me a long paragraph about why diversification matters",
    rounds: [[
      say(
        "Diversification is the idea that owning several different things means no single one of them can sink you. " +
          "If your whole portfolio were [[TSLA]], a bad quarter, a recall or one investigation would move all of " +
          "your money at once; spread across [[AAPL]], [[MSFT]], [[AMZN]] and cash, the same bad week becomes one " +
          "line in a table instead of the whole table. It doesn't make you right more often, and it won't stop a " +
          "market-wide fall, but it makes the outcome less about luck in one company and more about the market as a " +
          "whole, which over long stretches has tended to rise. That's also why bluechip's agents carry a stock cap: " +
          "it's diversification written down as a rule, so an enthusiastic agent can't quietly put everything into " +
          "its favourite stock while you're not looking.\n\n" +
          "A second paragraph, for rhythm: cash counts too. Keeping some lets you buy when prices drop without " +
          "selling something else first, and it's what the cash reserve policy protects."
      )
    ]]
  },
  {
    you: "Give me a checklist",
    rounds: [[
      say(
        "- [x] Fund your account\n- [x] Create your first agent\n- [ ] Add a recovery passkey\n" +
          "- [ ] Link Telegram for approvals\n- [ ] Set up a weekly buy"
      )
    ]]
  }
]
