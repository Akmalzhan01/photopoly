/**
 * Number formatting for a monospaced typeface.
 *
 * `Intl` groups thousands with U+00A0, which in IBM Plex Mono is a full
 * character wide — "3 990" reads as two separate figures. A narrow no-break
 * space keeps the grouping without splitting the number in half.
 */
const GROUPED = new Intl.NumberFormat("ru-RU");

/** U+202F narrow no-break space. */
const NARROW_NBSP = " ";

export function formatNumber(value: number): string {
  // Whatever separator the locale picked — space, non-breaking space — becomes
  // the narrow one.
  return GROUPED.format(value).replace(/[\s  ]/g, NARROW_NBSP);
}

/** Same formatting; named for the places that are showing money. */
export const formatSom = formatNumber;
