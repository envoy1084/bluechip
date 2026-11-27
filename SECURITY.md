# Security policy

bluechip runs an open beta on paper money (Base Sepolia, test tokens worth nothing). Its contracts have not had an
external audit yet; mainnet follows one.

## Report a vulnerability

Report privately, by email to [vedant@envoy1084.xyz](mailto:vedant@envoy1084.xyz) or through
[GitHub private vulnerability reporting](https://github.com/envoy1084/bluechip/security/advisories/new). Do not open a
public issue or pull request with exploit details before a fix is available.

Include:

- the affected component (a contract, the server, the web app) and the commit or deployment you tested;
- a minimal reproduction, with the expected and observed behaviour;
- the impact: what an attacker could do, and what they would need first;
- for a contract, the transaction or a Foundry test that shows it, if you have one.

Redact API keys, tokens, credentials and personal data.

## Scope

In scope:

- **Contracts** (`contracts/`): `AerodromeTradePolicy`, `TradeGuard` and its rules, `RecoveryDelayPolicy`, and how
  bluechip compiles an agent's session from them. For example, an agent's session key doing anything outside its
  policies, a recovery that skips or shortens its 48-hour delay, or a trade that escapes the Chainlink price check.
- **The server** (`apps/server`): authentication and sessions, passkey verification, access to another user's data,
  sealed agent keys, the bluechip guard key doing more than cancel a recovery, the Telegram bot and the assistant's
  tools acting past their risk levels.
- **The web app** (`apps/web`): cross-site scripting, signing something other than what the screen shows, leaking
  session data.

Out of scope: findings that need a compromised device or passkey, denial of service by volume, missing best-practice
headers without a concrete impact, and vulnerabilities solely in a dependency (report those to that project).

Test against your own local stack (`pnpm dev`) or your own paper money account. Do not access other users' data,
disrupt the public deployments, or spam the faucet.

## Disclosure

The maintainer investigates privately, keeps you informed, and coordinates the fix and its disclosure with you.
Accepted reports may get a GitHub security advisory and credit, if you want it. There is no bug bounty yet, and this
policy does not promise a response deadline.
