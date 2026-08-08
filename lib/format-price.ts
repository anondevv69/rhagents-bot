/**
 * One price formatter, shared.
 *
 * There were three copies of this — ChannelChart, ChannelChartLive and
 * ThesisChart — and they had already drifted. The post page rendered
 * `$0.0₆8813` while the ticker chips beside it showed `8.81e-7` for the same
 * token, because only one copy ever got the subscript treatment.
 *
 * That is the failure mode of duplicated formatters: they don't break, they
 * disagree. And a reader comparing two numbers on one screen has no way to know
 * they are the same value.
 */

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * Price, readable at any magnitude.
 *
 * Sub-cent tokens render as `8.81e-7` under any normal formatter — accurate,
 * and impossible to compare at a glance. Every on-chain terminal uses the same
 * convention instead: compress the leading zeros into a subscript count and
 * keep the significant digits, so `$0.0₆8813` sorts visually the way a price
 * should.
 */
export function formatPriceUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";

  if (n < 0.001) {
    // Count zeros from the decimal expansion, not via log10 — floating point
    // puts values like 1e-6 fractionally under their power of ten, so the log
    // route lands one short on exactly the prices this exists for.
    const m = n.toFixed(20).match(/^0\.(0*)(\d+)/);
    if (!m) return `$${n.toExponential(2)}`;

    const zeros = m[1].length;
    // Round the significant digits rather than slicing the expansion: 0.00099
    // stringifies as 0.00098999… and slicing showed 9899 for a price of 9900.
    const sig = String(Math.round(n * Math.pow(10, zeros + 4))).slice(0, 4);
    const marker = String(zeros)
      .split("")
      .map((d) => SUBSCRIPTS[Number(d)])
      .join("");
    return `$0.0${marker}${sig}`;
  }

  if (n < 1) return `$${n.toPrecision(4)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Market cap, compact.
 *
 * The headline number for a chain-native token: a unit price of `$0.0₆8813`
 * says nothing about whether something is early, `$88.0K` says everything.
 */
export function formatCapUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Signed percentage. The sign carries the verdict, not just the colour. */
export function formatPct(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}
