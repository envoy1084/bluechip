# Trading

## What you hold

The stocks on bluechip are Coinbase's tokenized stocks on Base. Each is priced by Chainlink's feed for it, and traded in
its USDC pool on Aerodrome. Your cash is USDC. The Stocks page lists every stock bluechip trades.

## Trading yourself

Open a stock, choose Buy or Sell, and type an amount in dollars or shares; the smallest trade is $1. The quote shows
what you get at least, and you sign the trade with Face ID. A trade that would fill for less than the quote fails, and
nothing is traded. In Chat, the assistant can prepare a trade for you to sign the same way.

## The fair price check

Every trade is checked against Chainlink's price for the stock. bluechip refuses a trade that would fill more than 1%
worse than it, 0.5% while prices are paused, and any trade while Chainlink's price is too old. When the stock market and
Chainlink are more than 1% apart, the quote warns you: Prices disagree.

## Prices on weekends and holidays

Prices move from Sunday evening to Friday evening, New York time. On weekends and market holidays Chainlink's prices are
paused at the last price, the pools may move meanwhile, and the stock page says Prices are paused. Your trades are held
to the tighter check, and agents whose Fair price rule doesn't trade on paused prices wait until they move again.

## What a trade costs

You pay Aerodrome's fee and any slippage, the price moving against a larger order. bluechip charges no fee of its
own and pays the gas. The costs are in your activity, under You paid and You got, with the fair price check it passed.
