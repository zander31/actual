// Pure helpers for the fork's Schedules screen. All amounts are integer cents;
// outflows are negative, as they are everywhere else in Actual.
import * as monthUtils from '@actual-app/core/shared/months';
import {
  extractScheduleConds,
  getNextDate,
  getScheduledAmount,
  scheduleIsRecurring,
} from '@actual-app/core/shared/schedules';
import type {
  ScheduleStatuses,
  ScheduleStatusType,
} from '@actual-app/core/shared/schedules';
import type { ScheduleEntity } from '@actual-app/core/types/models';

/** A transaction linked to a schedule — what the schedule actually charged. */
export type Charge = { date: string; amount: number };

/** Linked charges, newest first, grouped by schedule id. */
export function groupCharges(
  rows: ReadonlyArray<{
    schedule: string | null;
    date: string;
    amount: number;
  }>,
): Map<string, Charge[]> {
  const out = new Map<string, Charge[]>();
  for (const r of rows) {
    if (!r.schedule) continue;
    const list = out.get(r.schedule) ?? [];
    list.push({ date: r.date, amount: r.amount });
    out.set(r.schedule, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => b.date.localeCompare(a.date));
  }
  return out;
}

/**
 * Every date a schedule falls on in `[from, until)`. Mirrors the preview
 * transactions Actual already shows: a schedule whose next date is already
 * paid does not count that date again.
 */
export function occurrencesBetween(
  schedule: ScheduleEntity,
  status: ScheduleStatusType | undefined,
  from: string,
  until: string,
): string[] {
  if (schedule.completed || !schedule.next_date) return [];
  const { date: dateCond } = extractScheduleConds(schedule._conditions);
  const dates: string[] = [];
  if (status !== 'paid') {
    dates.push(schedule.next_date);
  }
  if (dateCond && scheduleIsRecurring(dateCond)) {
    let cursor = monthUtils.addDays(schedule.next_date, 1);
    if (cursor < from) cursor = from;
    for (let guard = 0; guard < 400 && cursor < until; guard++) {
      const next = getNextDate(dateCond, monthUtils.parseDate(cursor));
      if (next == null || next >= until) break;
      if (!dates.includes(next)) dates.push(next);
      // A weekend shift can land a date before the cursor; step past it.
      cursor = monthUtils.addDays(next < cursor ? cursor : next, 1);
    }
  }
  return dates.filter(d => d >= from && d < until);
}

export type WindowTotals = {
  /** Sum of scheduled outflows in the window, as a positive number. */
  outflow: number;
  /** Distinct schedules with at least one date in the window. */
  schedules: number;
  /** Income occurrences (deposits) in the window. */
  deposits: number;
};

export function windowTotals(
  schedules: readonly ScheduleEntity[],
  statuses: ScheduleStatuses,
  from: string,
  until: string,
): WindowTotals {
  let outflow = 0;
  let count = 0;
  let deposits = 0;
  for (const s of schedules) {
    const dates = occurrencesBetween(s, statuses.get(s.id), from, until);
    if (dates.length === 0) continue;
    count++;
    const amount = getScheduledAmount(s._amount);
    if (amount < 0) outflow += -amount * dates.length;
    else if (amount > 0) deposits += dates.length;
  }
  return { outflow, schedules: count, deposits };
}

/** Linked outflows actually charged in `[from, until)`, as a positive number. */
export function chargedBetween(
  charges: Map<string, Charge[]>,
  from: string,
  until: string,
): number {
  let total = 0;
  for (const list of charges.values()) {
    for (const c of list) {
      if (c.date >= from && c.date < until && c.amount < 0) total -= c.amount;
    }
  }
  return total;
}

export const DRIFT_THRESHOLD = 0.1;

export type Drift = {
  scheduleId: string;
  /** The level the charges used to sit at (or the scheduled amount). */
  from: number;
  /** The latest charge. */
  to: number;
  /** Signed change from `from` to `to`, by magnitude: 0.124 = 12.4% more. */
  change: number;
  /** When the charges moved off the scheduled amount. */
  since: string;
};

/**
 * A schedule has drifted when its latest linked charge is more than 10% away
 * from the amount the schedule expects. Looks only at the last six charges.
 * Ranges (`isbetween`) are skipped — they already say the amount moves.
 */
export function detectDrift(
  schedule: ScheduleEntity,
  charges: Charge[] | undefined,
): Drift | null {
  if (schedule.completed) return null;
  if (schedule._amountOp === 'isbetween') return null;
  const expected = Math.abs(getScheduledAmount(schedule._amount));
  const recent = (charges ?? []).slice(0, 6);
  if (!expected || recent.length < 2) return null;

  const off = (amount: number) =>
    Math.abs(Math.abs(amount) - expected) / expected > DRIFT_THRESHOLD;
  if (!off(recent[0].amount)) return null;

  // Walk back through the run of off-level charges to where it started.
  let start = 0;
  while (start + 1 < recent.length && off(recent[start + 1].amount)) start++;
  const before = recent[start + 1];
  const from = before ? Math.abs(before.amount) : expected;
  const to = Math.abs(recent[0].amount);
  if (!from || from === to) return null;

  return {
    scheduleId: schedule.id,
    from,
    to,
    change: (to - from) / from,
    since: recent[start].date,
  };
}

/** The last six charges as magnitudes, oldest first — a row's own history. */
export function chargeHistory(charges: Charge[] | undefined): number[] {
  return (charges ?? [])
    .slice(0, 6)
    .map(c => Math.abs(c.amount))
    .reverse();
}

/**
 * Whether a row's history went the wrong way: an outflow that rose, or income
 * that fell, by more than 2% across the window.
 */
export function historyWentWrong(values: number[], isIncome: boolean) {
  if (values.length < 2) return false;
  const first = values[0];
  const last = values[values.length - 1];
  return isIncome ? last < first * 0.98 : last > first * 1.02;
}
