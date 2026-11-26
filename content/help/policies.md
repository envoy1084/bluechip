# Policies

## How policies work

Each agent carries policies, and Base checks every trade the agent sends against them. bluechip also simulates a
trade as the agent before sending it: if a policy would refuse it, the trade is blocked and you see which policy
refused it and why.

## The policies

- Stocks and direction: the stocks it may trade, which way, and how much it may spend a day.
- Trade size: the largest trade it makes on its own; anything bigger waits for your Face ID.
- Trades a day: how many times a day it may trade.
- Max in one stock: the largest share of your money its trades may put in one stock.
- Cash reserve: the share of your money its trades always leave in cash.
- Fair price: how far from Chainlink's price a trade may fill, and whether it trades on weekends and holidays.
- Weekly slippage: the most it may lose to prices in a week, as a share of your money.
- Gas budget: the most gas it may spend a day.
- Target mix: the mix it keeps, trading only once the portfolio drifts past its trigger.
- Stop-loss floor: the price each stock has to fall to before it may sell.

## When a trade is blocked

A blocked trade sends nothing and costs nothing. Its card and the agent's activity say which policy refused it. You
can make the same trade from your own account with Face ID, or change the agent's policies.
