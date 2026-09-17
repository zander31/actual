// Pure helpers for the fork's Calendar + Forecast pages. All amounts are integer cents.
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

export const RED_BELOW = 50_000; // $500
export const YELLOW_BELOW = 100_000; // $1,000

export function dayColor(balance: number): 'red' | 'yellow' | 'green' {
  if (balance < RED_BELOW) return 'red';
  if (balance < YELLOW_BELOW) return 'yellow';
  return 'green';
}

/** Hypothetical spends keyed by date; each reduces that day and every later day. */
export function applyWhatIf(
  points: DayPoint[],
  whatIf: Record<string, number>,
): DayPoint[] {
  let running = 0;
  return points.map(p => {
    running += whatIf[p.date] ?? 0;
    return running ? { ...p, balance: p.balance - running } : p;
  });
}

export type SpendRates = { best: number; expected: number; worst: number }; // cents per day, >= 0

/** Monthly variable-spend totals (positive cents, one per month) → per-day rates. */
export function variableSpendRates(
  monthlyTotals: number[],
  daysPerMonth = 30.4,
): SpendRates {
  const totals = monthlyTotals.filter(t => t > 0);
  if (totals.length === 0) return { best: 0, expected: 0, worst: 0 };
  const mean = totals.reduce((s, t) => s + t, 0) / totals.length;
  return {
    best: Math.min(...totals) / daysPerMonth,
    expected: mean / daysPerMonth,
    worst: Math.max(...totals) / daysPerMonth,
  };
}

export type BandPoint = {
  date: string;
  schedules: number;
  expected: number;
  best: number;
  worst: number;
};

/** Overlay cumulative variable spend on the schedules-only projection. Day 0 is "today" (no overlay). */
export function projectBands(
  points: DayPoint[],
  rates: SpendRates,
): BandPoint[] {
  return points.map((p, i) => ({
    date: p.date,
    schedules: p.balance,
    expected: Math.round(p.balance - rates.expected * i),
    best: Math.round(p.balance - rates.best * i),
    worst: Math.round(p.balance - rates.worst * i),
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

/** Group transactions (date, amount<0) into positive monthly totals, ordered by month. */
export function monthlyTotals(
  txns: { date: string; amount: number }[],
): number[] {
  const m = new Map<string, number>();
  for (const t of txns) {
    m.set(t.date.slice(0, 7), (m.get(t.date.slice(0, 7)) ?? 0) - t.amount);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}
