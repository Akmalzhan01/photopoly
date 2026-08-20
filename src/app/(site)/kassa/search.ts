/**
 * Reading the period out of the query string.
 *
 * Shared by all four pages so they interpret `?davr`, `?dan` and `?gacha` the
 * same way — a tab that disagreed would show different numbers for what looks
 * like the same window.
 */

export type Search = { [key: string]: string | string[] | undefined };

/** A repeated query parameter is somebody's doing, not ours; take the first. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readSearch(params: Search) {
  return {
    davr: first(params.davr),
    dan: first(params.dan),
    gacha: first(params.gacha),
  };
}
