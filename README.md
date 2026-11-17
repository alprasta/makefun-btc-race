# makefun-btc-race

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/alprasta/makefun-btc-race/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/alprasta/makefun-btc-race/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-buy mean-reversion bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty. It trades Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute on-chain bars, starting from $1,000 of paper money. It buys with all cash when the close sits at least 80 bps below its trailing 90-bar moving average, sells half once the position is worth 190 bps over its cost, and sells the rest once the close is back at or above the average; a 250 bps stop-loss and an 8% peak-equity drawdown brake sit underneath. All decisions use exact integer arithmetic — no floats, no clock, no network, no randomness — so two runs produce byte-identical action logs. Dev-window grade (local, kit harness): net PnL +$39.96 on $1,000, 7 trades, max drawdown 0.72%.

## Run it

```sh
node main.ts
```

---

Entered on [make.fun](https://make.fun/?ref=58yp00jq&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards
