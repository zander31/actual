// Pure helpers for the fork's Calendar + Forecast pages. All amounts are integer cents.
import * as monthUtils from '@actual-app/core/shared/months';
import type { ForecastDataPoint } from '@actual-app/core/types/models/forecast';

export type DayPoint = {
  date: string;
  balance: number;
  transactions: ForecastDataPoint['transactions'];
};

/** forecast/generate returns one point per account per day — collapse to one point per day. */
export function combineByDate(points: ForecastDataPoint[]): DayPoint[] {
  const byDate = new Map<string, DayPoint>();
  for (const p of points) {
    const cur = byDate.get(p.date) ?? {
      date: p.date,
      balance: 0,
      transactions: [],
    };
    cur.balance += p.balance;
    cur.transactions = cur.transactions.concat(p.transactions);
    byDate.set(p.date, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The window `forecast/generate` has to be asked for so that `month` reads
 * honestly, and the first day of `month` itself.
 *
 * The handler seeds its running balance from *posted* transactions before
 * `startDate` and only injects schedule occurrences from today onward. Ask it
 * for a future month on its own and it opens that month at today's balance,
 * silently dropping every bill and paycheck scheduled between now and then —
 * which is why each month used to restart from the same figure instead of
 * carrying on from the one before. Always start no later than today and slice
 * the answer back down to the month.
 */
export function forecastWindow(month: string, today: string) {
  const first = monthUtils.firstDayOfMonth(month);
  return {
    startDate: first < today ? first : today,
    endDate: monthUtils.lastDayOfMonth(month),
    first,
  };
}

export type PostedTxn = {
  date: string;
  amount: number;
  payee: string;
  schedule: string | null;
};

export type CalendarDay = DayPoint & { posted: PostedTxn[] };

/**
 * How early a linked transaction may land and still settle the schedule's next
 * occurrence. Upstream allows two days; VA pay posts up to five early, and was
 * being projected a second time on its due date.
 */
export const EARLY_POST_DAYS = 7;

/**
 * The calendar's days: what really happened up to today, then the schedules.
 *
 * `opening` is every posted cent before `start`; `posted` runs from
 * EARLY_POST_DAYS before `start` through `last` (the lead-in only settles
 * schedules). `scheduled` is forecast/generate's answer, used for its schedule
 * occurrences only — its balances assume a due-today bill has already left.
 *
 * Days through today carry the real balance. A schedule due today or earlier
 * that has not posted is still listed on its day but lands tomorrow. Days are
 * computed from `start` so a future month opens on everything in between, and
 * returned from `first`.
 */
export function buildCalendarDays({
  opening,
  posted,
  scheduled,
  start,
  first,
  last,
  today,
}: {
  opening: number;
  posted: PostedTxn[];
  scheduled: ForecastDataPoint[];
  start: string;
  first: string;
  last: string;
  today: string;
}): CalendarDay[] {
  const postedByDay = new Map<string, PostedTxn[]>();
  for (const p of posted) {
    if (p.date < start) continue;
    postedByDay.set(p.date, [...(postedByDay.get(p.date) ?? []), p]);
  }

  const occurrences = scheduled
    .flatMap(p => p.transactions.map(t => ({ ...t, date: p.date })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  const listedByDay = new Map<string, DayPoint['transactions']>();
  const landsByDay = new Map<string, number>();
  const tomorrow = monthUtils.addDays(today, 1);
  for (const { date, ...occ } of occurrences) {
    // ponytail: only a schedule's first projected occurrence can be settled
    // early; a biweekly paid more than a week late would still double-count.
    const isFirst = !seen.has(occ.scheduleId);
    seen.add(occ.scheduleId);
    const lookback = monthUtils.subDays(date, EARLY_POST_DAYS);
    if (
      isFirst &&
      posted.some(
        p =>
          p.schedule === occ.scheduleId && p.date >= lookback && p.date <= date,
      )
    ) {
      continue;
    }
    listedByDay.set(date, [...(listedByDay.get(date) ?? []), occ]);
    const lands = date > today ? date : tomorrow;
    landsByDay.set(lands, (landsByDay.get(lands) ?? 0) + occ.amount);
  }

  let running = opening;
  const days: CalendarDay[] = [];
  for (const date of monthUtils.dayRangeInclusive(start, last)) {
    const dayPosted = postedByDay.get(date) ?? [];
    running +=
      dayPosted.reduce((sum, p) => sum + p.amount, 0) +
      (landsByDay.get(date) ?? 0);
    if (date >= first) {
      days.push({
        date,
        balance: running,
        transactions: listedByDay.get(date) ?? [],
        posted: dayPosted,
      });
    }
  }
  return days;
}

export const RED_BELOW = 50_000; // $500
export const YELLOW_BELOW = 100_000; // $1,000

export function dayColor(balance: number): 'red' | 'yellow' | 'green' {
  if (balance < RED_BELOW) return 'red';
  if (balance < YELLOW_BELOW) return 'yellow';
  return 'green';
}

/** Hypothetical spends keyed by date; each reduces that day and every later day. */
export function applyWhatIf<T extends DayPoint>(
  points: T[],
  whatIf: Record<string, number>,
): T[] {
  let running = 0;
  return points.map(p => {
    running += whatIf[p.date] ?? 0;
    return running ? { ...p, balance: p.balance - running } : p;
  });
}

/** Whether any scheduled deposit lands in the window at all. */
export function hasScheduledIncome(points: DayPoint[]): boolean {
  return points.some(p => p.transactions.some(t => t.amount > 0));
}

/**
 * Signed cents per day of everything the schedules do not already account for.
 * Positive is money arriving. `expected` is the mean month, `best` the most
 * favourable month observed and `worst` the least.
 */
export type NetRates = { best: number; expected: number; worst: number };

/**
 * Net non-scheduled flow per calendar month, signed, one entry per month in
 * `months` — a month with nothing in it is a real zero, not a gap.
 *
 * Both signs are kept on purpose. Counting only the outflows made the forecast
 * subtract a household's entire spending while adding none of its income, so
 * any file whose paycheques are not schedules projected straight to zero no
 * matter how much it actually earned.
 */
export function monthlyNet(
  txns: ReadonlyArray<{ date: string; amount: number }>,
  months: readonly string[],
): number[] {
  const byMonth = new Map(months.map(m => [m, 0]));
  for (const t of txns) {
    const key = t.date.slice(0, 7);
    if (byMonth.has(key)) byMonth.set(key, byMonth.get(key)! + t.amount);
  }
  return months.map(m => byMonth.get(m) ?? 0);
}

/** How many complete months of history the bands need before they mean anything. */
export const MIN_SAMPLE_MONTHS = 2;

/**
 * Monthly net totals → a per-day band. Returns null on too thin a sample: one
 * month makes best, expected and worst identical, which reads as certainty the
 * data cannot support.
 */
export function netFlowRates(
  monthlyNets: readonly number[],
  daysPerMonth = 30.4,
): NetRates | null {
  if (monthlyNets.length < MIN_SAMPLE_MONTHS) return null;
  const mean = monthlyNets.reduce((s, t) => s + t, 0) / monthlyNets.length;
  return {
    best: Math.max(...monthlyNets) / daysPerMonth,
    expected: mean / daysPerMonth,
    worst: Math.min(...monthlyNets) / daysPerMonth,
  };
}

export type BandPoint = {
  date: string;
  schedules: number;
  expected: number;
  best: number;
  worst: number;
};

/**
 * Overlay cumulative non-scheduled flow on the schedules-only projection. Day 0
 * is the start of the series and carries no overlay. With no usable sample the
 * three bands collapse onto the schedules line rather than inventing a spread.
 */
export function projectBands(
  points: DayPoint[],
  rates: NetRates | null,
): BandPoint[] {
  return points.map((p, i) => ({
    date: p.date,
    schedules: p.balance,
    expected: Math.round(p.balance + (rates?.expected ?? 0) * i),
    best: Math.round(p.balance + (rates?.best ?? 0) * i),
    worst: Math.round(p.balance + (rates?.worst ?? 0) * i),
  }));
}

/** Last point of each calendar month in the series; the current month only counts if the series reaches its last day. */
export function monthEnds(bands: BandPoint[], count = 3): BandPoint[] {
  const last = new Map<string, BandPoint>();
  for (const b of bands) last.set(b.date.slice(0, 7), b);
  const months = [...last.keys()].sort();
  const todayMonth = bands[0]?.date.slice(0, 7);
  return months
    .filter(m => m !== todayMonth || last.get(m)!.date.endsWith(lastDayOf(m)))
    .slice(0, count)
    .map(m => last.get(m)!);
}

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return String(new Date(y, m, 0).getDate()).padStart(2, '0');
}
