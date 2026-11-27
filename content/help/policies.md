# Agent rules

## How rules work

Each agent carries rules (policies), locked onchain with your Face ID, and Base checks every trade the agent sends
against them. Before sending a trade, bluechip also tries it as the agent: if a rule would refuse it, the trade is
blocked and you see which rule refused it and why. Some rules every agent has; the others are optional.

## Stocks and direction

The stocks it may trade, which way, and how much it may spend a day. It may buy and sell, only buy, only sell, or only
trade back toward your target mix. Every agent has this rule; its daily budget starts at $250.

## Trade size

The largest trade it makes on its own (Ask you above, $100 to start) and its smallest trade ($5). A trade over the
largest waits for your approval with Face ID. Every agent has this rule.

## Fair price

How far from Chainlink's price a trade may fill (1% to start), and whether it trades while prices are paused on weekends
and holidays, when it is held to half that distance. Every agent has this rule.

## Trades a day

How many trades it may make in a day; No limit to start. Every agent has this rule.

## Max in one stock

The largest share of your portfolio its trades may put in one stock: 30% to start. Optional.

## Cash reserve

The share of your portfolio its trades always leave in cash: 10% to start. Optional.

## Target mix

The mix of stocks and cash it keeps. It trades only once your portfolio drifts past the trigger (5% to start), sells
only what is over its target and buys only what is under. A Rebalancer has it. Optional.

## Stop-loss floor

A price for each stock: it may sell that stock only at or under its floor, so it never sells at a good price. Buys
aren't affected. A Stop-loss guard offers it. Optional.

## Weekly slippage

The most it may lose to prices over seven days, as a share of your portfolio (1% to start). The allowance frees up
gradually over the week. Optional.

## Set by bluechip

Two rules every agent carries, with values bluechip sets: its gas budget, the most gas it may spend a day, and the check
that each operation it sends is a trade its other rules allow, so it can never send money out of your account.

## When a trade is blocked

A blocked trade sends nothing and costs nothing. Its card, the agent's activity and the A policy stopped a trade
notification say which rule refused it. You can make the same trade from your own account with Face ID, or change the
agent's rules.
