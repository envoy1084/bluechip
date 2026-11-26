# Gas

## Who pays gas

Every trade on Base costs a little gas. Unless bluechip pays it for you, it is paid in ETH from your bluechip account,
so keep a little ETH there for your agents to trade.

## When there isn't enough ETH

An agent's trade that can't pay its gas waits instead of failing, and its card says your account needs a little ETH
for gas. It goes on once there is enough.

## The gas budget

Each agent has a gas budget: the most gas it may spend a day. When gas costs more than the budget allows, its trades
wait; when it has used the day's budget, they wait for the next UTC day.
