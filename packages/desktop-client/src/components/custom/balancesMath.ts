// Fork: balance history for the accounts overview. The page runs one grouped
// query (net change per account per day) and everything here is derived from
// it in memory, so switching the chart's range never goes back to the database.
import * as d from 'date-fns';

export type DayChange = { account: string; date: string; amount: number };

export type BalanceRange = '1W' | '1M' | '3M' | 'YTD' | 'ALL';

const iso = (date: Date) => d.format(date, 'yyyy-MM-dd');

/**
 * Sorted, with anything dated after today counted as today — the account
 * balance the rest of the app shows already includes future-dated entries, so
 * the curve has to end on that same figure.
 */
export function normalizeChanges(
  rows: ReadonlyArray<DayChange>,
  accountIds: ReadonlySet<string>,
  today: string,
): DayChange[] {
  return rows
    .filter(r => accountIds.has(r.account))
    .map(r => (r.date > today ? { ...r, date: today } : r))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The first day a range covers, inclusive. */
export function rangeStart(
  range: BalanceRange,
  today: string,
  earliest: string | null,
): string {
  const now = d.parseISO(today);
  switch (range) {
    case '1W':
      return iso(d.subDays(now, 7));
    case '1M':
      return iso(d.subMonths(now, 1));
    case '3M':
      return iso(d.subMonths(now, 3));
    case 'YTD':
      return `${today.slice(0, 4)}-01-01`;
    default: {
      const fallback = iso(d.subMonths(now, 1));
      return earliest && earliest < fallback ? earliest : fallback;
    }
  }
}

/**
 * Evenly spaced days from `start` to `end`, both included — daily when the
 * span is short enough, thinned to about `max` points when it isn't.
 */
export function sampleDays(start: string, end: string, max = 120): string[] {
  const from = d.parseISO(start);
  const span = Math.max(0, d.differenceInCalendarDays(d.parseISO(end), from));
  if (span === 0) return [start, end];
  const step = Math.max(1, Math.ceil(span / (max - 1)));
  const days: string[] = [];
  for (let offset = 0; offset < span; offset += step) {
    days.push(iso(d.addDays(from, offset)));
  }
  days.push(end);
  return days;
}

/**
 * The closing balance on each of `days` (ascending), summed over whatever
 * accounts `changes` holds. One sweep: O(changes + days).
 */
export function balancesOn(
  changes: ReadonlyArray<DayChange>,
  days: ReadonlyArray<string>,
): number[] {
  const out: number[] = [];
  let running = 0;
  let i = 0;
  for (const day of days) {
    while (i < changes.length && changes[i].date <= day) {
      running += changes[i].amount;
      i++;
    }
    out.push(running);
  }
  return out;
}

export type AccountSummary = {
  balance: number;
  /** Change since the first of the month. */
  monthChange: number;
  /** Closing balances over the recent past, oldest first. */
  history: number[];
};

/** Per-account figures for the rows, from the same changes as the chart. */
export function summarizeAccounts(
  changes: ReadonlyArray<DayChange>,
  today: string,
  historyDays: ReadonlyArray<string>,
): Map<string, AccountSummary> {
  const byAccount = new Map<string, DayChange[]>();
  for (const c of changes) {
    const list = byAccount.get(c.account);
    if (list) list.push(c);
    else byAccount.set(c.account, [c]);
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  const summaries = new Map<string, AccountSummary>();
  for (const [account, list] of byAccount) {
    let balance = 0;
    let monthChange = 0;
    for (const c of list) {
      balance += c.amount;
      if (c.date >= monthStart) monthChange += c.amount;
    }
    summaries.set(account, {
      balance,
      monthChange,
      history: balancesOn(list, historyDays),
    });
  }
  return summaries;
}
