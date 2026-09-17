import {
  applyWhatIf,
  combineByDate,
  dayColor,
  forecastWindow,
  hasScheduledIncome,
  monthEnds,
  monthlyNet,
  netFlowRates,
  projectBands,
} from './forecastMath';

const pt = (date: string, balance: number, accountId = 'a') => ({
  date,
  balance,
  accountId,
  accountName: accountId,
  transactions: [],
});

const withTxn = (date: string, balance: number, amount: number) => ({
  ...pt(date, balance),
  transactions: [{ amount, payee: 'p', scheduleId: 's', scheduleName: 'Pay' }],
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

  // The month-to-month bug: asking for a future month on its own makes
  // forecast/generate open it at today's balance, dropping every schedule
  // between now and then. The window has to reach back to today.
  test('forecastWindow starts at today for a future month, and at the 1st otherwise', () => {
    expect(forecastWindow('2026-11', '2026-09-17')).toEqual({
      startDate: '2026-09-17',
      endDate: '2026-11-30',
      first: '2026-11-01',
    });
    expect(forecastWindow('2026-09', '2026-09-17')).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      first: '2026-09-01',
    });
    expect(forecastWindow('2026-06', '2026-09-17')).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      first: '2026-06-01',
    });
  });

  test('hasScheduledIncome sees a deposit, ignores outflows only', () => {
    expect(hasScheduledIncome([withTxn('2026-09-01', 0, 250_000)])).toBe(true);
    expect(hasScheduledIncome([withTxn('2026-09-01', 0, -250_000)])).toBe(
      false,
    );
    expect(hasScheduledIncome([pt('2026-09-01', 0)])).toBe(false);
  });

  test('monthlyNet keeps both signs and reports an empty month as zero', () => {
    expect(
      monthlyNet(
        [
          { date: '2026-06-03', amount: -100 },
          { date: '2026-06-20', amount: 400 },
          { date: '2026-08-01', amount: -10 },
        ],
        ['2026-06', '2026-07', '2026-08'],
      ),
    ).toEqual([300, 0, -10]);
  });

  test('monthlyNet ignores months outside the asked-for list', () => {
    expect(
      monthlyNet([{ date: '2026-05-01', amount: -999 }], ['2026-06']),
    ).toEqual([0]);
  });

  test('netFlowRates spans the months observed, signed', () => {
    expect(netFlowRates([-3040, 6080], 30.4)).toEqual({
      best: 200,
      expected: 50,
      worst: -100,
    });
  });

  test('netFlowRates refuses a sample too thin to carry a band', () => {
    expect(netFlowRates([])).toBeNull();
    expect(netFlowRates([-3040])).toBeNull();
  });

  // A household that earns more outside its schedules than it spends must
  // project upward. Counting outflows alone always drove this negative.
  test('projectBands follows net flow in both directions', () => {
    const pts = combineByDate([
      pt('2026-09-01', 10_000),
      pt('2026-09-02', 10_000),
      pt('2026-09-03', 10_000),
    ]);
    const up = projectBands(pts, { best: 300, expected: 200, worst: -100 });
    expect(up.map(b => b.expected)).toEqual([10_000, 10_200, 10_400]);
    expect(up.map(b => b.worst)).toEqual([10_000, 9_900, 9_800]);
    expect(up.map(b => b.best)).toEqual([10_000, 10_300, 10_600]);
  });

  test('projectBands collapses onto the schedules line with no usable sample', () => {
    const pts = combineByDate([
      pt('2026-09-01', 10_000),
      pt('2026-09-02', 9_000),
    ]);
    const b = projectBands(pts, null);
    expect(b.map(p => [p.best, p.expected, p.worst])).toEqual([
      [10_000, 10_000, 10_000],
      [9_000, 9_000, 9_000],
    ]);
  });

  test('monthEnds returns the last point of each month in the series (current month only if it reaches month end)', () => {
    const pts = combineByDate([
      pt('2026-08-30', 1),
      pt('2026-08-31', 2),
      pt('2026-09-15', 3),
      pt('2026-09-30', 4),
      pt('2026-10-01', 5),
    ]);
    const ends = monthEnds(projectBands(pts, null));
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
    expect(monthEnds(projectBands(pts2, null)).map(e => e.date)).toEqual([
      '2026-09-30',
    ]);
  });
});
