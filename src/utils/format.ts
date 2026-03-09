// ---------------------------------------------------------------------------
// Funnel Gap Analyzer — Formatting Utilities
// ---------------------------------------------------------------------------

/**
 * Clamp a number to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format a dollar amount for display.
 *
 * - Values ≥ 1,000,000 → "$1.2M"
 * - Values ≥ 10,000    → "$12.3K"
 * - Values ≥ 1         → "$1,234"
 * - Values < 1          → "$0.00"
 * - Negative values     → "−$1,234" (uses proper minus sign)
 */
export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    // Show one decimal unless it's a whole number
    const formatted = millions % 1 === 0
      ? `${millions.toFixed(0)}M`
      : `${millions.toFixed(1)}M`;
    return `${sign}$${formatted}`;
  }

  if (abs >= 10_000) {
    const thousands = abs / 1_000;
    const formatted = thousands % 1 === 0
      ? `${thousands.toFixed(0)}K`
      : `${thousands.toFixed(1)}K`;
    return `${sign}$${formatted}`;
  }

  if (abs >= 1) {
    const rounded = Math.round(abs);
    return `${sign}$${rounded.toLocaleString('en-US')}`;
  }

  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * Format an integer with comma separators.
 * Rounds to nearest integer first.
 *
 * - 10000 → "10,000"
 * - 1234567 → "1,234,567"
 * - 0.7 → "1"
 */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Format a percentage with one decimal place and a % suffix.
 *
 * - 2.5 → "2.5%"
 * - 35.0 → "35.0%"
 * - 100 → "100.0%"
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format a large number with K/M suffixes for compact display.
 *
 * - 500 → "500"
 * - 10000 → "10K"
 * - 1500000 → "1.5M"
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }

  if (abs >= 10_000) {
    const k = abs / 1_000;
    return `${sign}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }

  return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
}
