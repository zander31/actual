import {
  applyWhatIf,
  combineByDate,
  dayColor,
  monthEnds,
  monthlyTotals,
  projectBands,
  variableSpendRates,
} from './forecastMath';

const pt = (date: string, balance: number, accountId = 'a') => ({
  date,
  balance,
  accountId,
  accountName: accountId,
  transactions: [],
});

describe('forecastMath', () => {
  test('combineByDate sums accounts per day and sorts', () => {
    const out = combineByDate([
      pt('2026-09-02', 100),
      pt('2026-09-01', 50),
      pt('2026-09-01', 25, 'b'),
    ]);
    expect(out.map(p => [p.date, p.balance])).toEqual([
      ['2026-09-01', 75],
      ['2026-09-02', 100],
    ]);
  });

  test('dayColor thresholds: <$500 red, <$1000 yellow, else green', () => {
    expect(dayColor(49_999)).toBe('red');
    expect(dayColor(50_000)).toBe('yellow');
    expect(dayColor(100_000)).toBe('green');
  });

  test('applyWhatIf subtracts from that day onward, cumulatively', () => {
    const pts = combineByDate([
      pt('2026-09-01', 1000),
      pt('2026-09-02', 1000),
      pt('2026-09-03', 1000),
    ]);
    const out = applyWhatIf(pts, { '2026-09-02': 300, '2026-09-03': 100 });
    expect(out.map(p => p.balance)).toEqual([1000, 700, 600]);
  });

  test('variableSpendRates uses min/mean/max of monthly totals per day', () => {
    const r = variableSpendRates([3040, 6080, 9120], 30.4);
    expect(r).toEqual({ best: 100, expected: 200, worst: 300 });
    expect(variableSpendRates([])).toEqual({ best: 0, expected: 0, worst: 0 });
  });

  test('projectBands overlays cumulative spend starting the day after index 0', () => {
    const pts = combineByDate([
      pt('2026-09-01', 10_000),
      pt('2026-09-02', 10_000),
      pt('2026-09-03', 20_000),
    ]);
    const b = projectBands(pts, { best: 100, expected: 200, worst: 300 });
    expect(b[0]).toMatchObject({
      schedules: 10_000,
      expected: 10_000,
      best: 10_000,
      worst: 10_000,
    });
    expect(b[2]).toMatchObject({
      schedules: 20_000,
      expected: 19_600,
      best: 19_800,
      worst: 19_400,
    });
  });

  test('monthEnds returns the last point of each month in the series (current month only if it reaches month end)', () => {
    const pts = combineByDate([
      pt('2026-08-30', 1),
      pt('2026-08-31', 2),
      pt('2026-09-15', 3),
      pt('2026-09-30', 4),
      pt('2026-10-01', 5),
    ]);
    const ends = monthEnds(
      projectBands(pts, { best: 0, expected: 0, worst: 0 }),
    );
    expect(ends.map(e => e.date)).toEqual([
      '2026-08-31',
      '2026-09-30',
      '2026-10-01',
    ]);
    const pts2 = combineByDate([
      pt('2026-08-20', 1),
      pt('2026-08-25', 2),
      pt('2026-09-30', 4),
    ]);
    expect(
      monthEnds(projectBands(pts2, { best: 0, expected: 0, worst: 0 })).map(
        e => e.date,
      ),
    ).toEqual(['2026-09-30']);
  });

  test('monthlyTotals groups outflows into positive per-month totals', () => {
    expect(
      monthlyTotals([
        { date: '2026-06-03', amount: -100 },
        { date: '2026-06-20', amount: -50 },
        { date: '2026-07-01', amount: -10 },
      ]),
    ).toEqual([150, 10]);
  });
});
