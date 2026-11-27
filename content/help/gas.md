# Gas

## Who pays gas

Every trade on Base costs a little gas, the network's fee. bluechip pays it for you today, for your own trades, your
agents' and your withdrawals, on paper money and with real money, so you don't need ETH in your account. If that ever
changes, gas is paid in ETH from your account and bluechip tells you first.

## The gas budget

Each agent carries a gas budget, set by bluechip: the most gas it may spend a day, with room for fee spikes. It is one
of its rules locked onchain, so even a leaked agent key couldn't spend more. You don't need to change it.

## When a trade waits for gas

When gas costs more than an agent's budget allows, or it has used the day's budget, its trade waits instead of failing,
and its card says why. It goes on once gas is cheaper or the next UTC day starts.
