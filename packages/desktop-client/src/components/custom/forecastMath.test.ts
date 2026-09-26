import {
  applyWhatIf,
  buildCalendarDays,
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

  describe('buildCalendarDays', () => {
    const sched = (date: string, amount: number, scheduleId: string) => ({
      ...pt(date, 0),
      transactions: [
        { amount, payee: scheduleId, scheduleId, scheduleName: scheduleId },
      ],
    });
    const posted = (
      date: string,
      amount: number,
      schedule: string | null = null,
    ) => ({
      date,
      amount,
      payee: schedule ?? 'shop',
      schedule,
    });
    const base = {
      opening: 1_000_00,
      start: '2026-09-24',
      first: '2026-09-24',
      last: '2026-09-30',
      today: '2026-09-25',
    };

    test('days up to today are the real balance, with what actually posted', () => {
      const days = buildCalendarDays({
        ...base,
        posted: [
          posted('2026-09-24', -50_00),
          posted('2026-09-25', 2_900_30, 'va'),
        ],
        scheduled: [],
      });
      expect(days.find(d => d.date === '2026-09-24')?.balance).toBe(950_00);
      const today = days.find(d => d.date === '2026-09-25')!;
      expect(today.balance).toBe(3_850_30);
      expect(today.posted.map(p => p.amount)).toEqual([2_900_30]);
    });

    test('a paycheck that posted early is not projected again on its due date', () => {
      const days = buildCalendarDays({
        ...base,
        posted: [posted('2026-09-25', 2_900_30, 'va')],
        scheduled: [sched('2026-09-30', 2_900_30, 'va')],
      });
      expect(days.at(-1)?.balance).toBe(3_900_30);
      expect(days.at(-1)?.transactions).toEqual([]);
    });

    test('a bill due today that has not posted is listed today but lands tomorrow', () => {
      const days = buildCalendarDays({
        ...base,
        posted: [],
        scheduled: [
          sched('2026-09-25', -375_00, 'camper'),
          sched('2026-09-28', -100_00, 'ins'),
        ],
      });
      const byDate = new Map(days.map(d => [d.date, d]));
      expect(byDate.get('2026-09-25')?.balance).toBe(1_000_00);
      expect(byDate.get('2026-09-25')?.transactions).toHaveLength(1);
      expect(byDate.get('2026-09-26')?.balance).toBe(625_00);
      expect(byDate.get('2026-09-28')?.balance).toBe(525_00);
    });

    test('future-dated posted transactions count on their day', () => {
      const days = buildCalendarDays({
        ...base,
        posted: [posted('2026-09-26', -592_65, 'heloc')],
        scheduled: [],
      });
      expect(days.find(d => d.date === '2026-09-26')?.balance).toBe(407_35);
    });

    test('a future month opens on everything that lands between today and its 1st', () => {
      const days = buildCalendarDays({
        ...base,
        start: '2026-09-25',
        first: '2026-10-01',
        last: '2026-10-03',
        posted: [posted('2026-09-28', -490_72, 'avant')],
        scheduled: [
          sched('2026-09-28', -100_00, 'ins'),
          // paid early on the 28th: not projected again
          sched('2026-10-02', -490_72, 'avant'),
        ],
      });
      expect(days.map(d => d.date)).toEqual([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
      ]);
      expect(days.map(d => d.balance)).toEqual([409_28, 409_28, 409_28]);
    });

    test('lookback transactions before the start only suppress, never re-add', () => {
      const days = buildCalendarDays({
        ...base,
        posted: [posted('2026-09-20', -2_900_30, 'va')],
        scheduled: [sched('2026-09-26', 2_900_30, 'va')],
      });
      expect(days.at(-1)?.balance).toBe(1_000_00);
    });
  });
});
