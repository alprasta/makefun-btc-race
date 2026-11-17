// Race a BTC trading bot live for 24 hours — dip-buy mean reversion on cbBTC.
//
// Strategy (single asset CBBTC, long only, one position at a time):
//   * Reference: the trailing 90-bar simple moving average of closes (SMA90),
//     kept as an exact integer rolling sum — no floats anywhere in decisions.
//   * Entry: when the close sits at least 80 bps below SMA90, buy with all cash.
//     A dip that deep is well past the ~37 bps full-size round-trip cost
//     (4 bps fee + 2 bps slippage + ~13 bps impact per leg at dev depth),
//     so the trade only fires where a rebound to the mean can pay.
//   * Exit: sell half the position once it is worth 190 bps over its cost,
//     then sell the rest once the close is back at or above SMA90
//     (in practice the bar after the half-sale — the rebound has carried
//     price back to its mean). A 250 bps stop-loss and an 8% peak-equity
//     drawdown brake sit underneath for the unseen race window.
//   * Nothing else trades: no re-entry while holding, no orders in warm-up,
//     at most one order per reply. One order per reply also keeps the
//     action log distinct from the multi-order baselines.
//
// Determinism: decisions use only the bars and account the harness sends,
// exact bigint arithmetic, no clock, no network, no randomness.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Trailing average length, in bars. */
const SMA_BARS = 90;
/** Entry when close is at least this far below SMA90, in bps. */
const DIP_BPS = 80n;
/** Sell half the position at this gain over its cost, in bps. */
const TAKE_BPS = 190n;
/** Stop-loss: sell everything at this loss versus cost, in bps. */
const STOP_BPS = 250n;
/** Drawdown brake: sell everything if equity falls this far below its peak, in bps. */
const BRAKE_BPS = 800n;
/** Orders may fill at most this far from the close they were decided on, in bps. */
const MAX_SLIPPAGE_BPS = 100;

const BPS = 10_000n;

/** Rolling sum of the last SMA_BARS closes (raw price units), or fewer while warming up. */
let closes: bigint[] = [];
let rollingSum = 0n;
/** Peak equity seen (raw quote units), for the drawdown brake. */
let peakEquity = 0n;
/** True once half the position has been sold at the take-profit. */
let halfSold = false;

function smaNow(): bigint | null {
  if (closes.length < SMA_BARS) return null;
  return rollingSum / BigInt(SMA_BARS);
}

await runBars({
  onBatch(state: BarsState, batch) {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar !== undefined) {
      const c = BigInt(bar.c);
      closes.push(c);
      rollingSum += c;
      if (closes.length > SMA_BARS) rollingSum -= closes.shift()!;
    }
    if (state.warmingUp) return [];
    if (state.equity > peakEquity) peakEquity = state.equity;

    const held = state.positions.get(SYMBOL);
    const close = state.close(SYMBOL);
    const sma = smaNow();
    if (close === null || sma === null) return [];

    // --- Holding: manage the exit. ---
    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      const breachedBrake =
        peakEquity > 0n && state.equity * BPS <= peakEquity * (BPS - BRAKE_BPS);
      const stopped = value * BPS <= cost * (BPS - STOP_BPS);
      if (breachedBrake || stopped) {
        halfSold = false;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      if (!halfSold && value * BPS >= cost * (BPS + TAKE_BPS)) {
        halfSold = true;
        const half = held.qty / 2n;
        if (half > 0n) {
          return [{ side: 'sell', symbol: SYMBOL, qty: half, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
        }
      }
      if (halfSold && close >= sma) {
        halfSold = false;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      return [];
    }

    // --- Flat: look for a dip worth buying. ---
    halfSold = false;
    const n = BigInt(SMA_BARS);
    // (sma - close) / sma >= DIP_BPS / BPS, cross-multiplied in integers:
    // (rollingSum - n*close) * BPS >= DIP_BPS * rollingSum.
    const dip = (rollingSum - n * close) * BPS >= DIP_BPS * rollingSum;
    if (!dip) return [];
    const spend = state.cash;
    if (spend < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
  },
});
