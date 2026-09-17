import type { ScheduleEntity } from '@actual-app/core/types/models';

import {
  chargedBetween,
  chargeHistory,
  detectDrift,
  groupCharges,
  historyWentWrong,
  occurrencesBetween,
  scheduleCoverage,
} from './scheduleMath';

function schedule(overrides: Partial<ScheduleEntity>): ScheduleEntity {
  return {
    id: 's1',
    rule: 'r1',
    next_date: '2026-09-20',
    completed: false,
    posts_transaction: false,
    tombstone: false,
    _payee: 'p1',
    _account: 'a1',
    _amount: -1618,
    _amountOp: 'is',
    _date: '2026-09-20',
    _conditions: [],
    _actions: [],
    ...overrides,
  } as ScheduleEntity;
}

describe('detectDrift', () => {
  it('flags a latest charge more than 10% off the schedule', () => {
    const drift = detectDrift(schedule({}), [
      { date: '2026-09-19', amount: -1818 },
      { date: '2026-08-19', amount: -1818 },
      { date: '2026-07-19', amount: -1618 },
      { date: '2026-06-19', amount: -1618 },
    ]);
    expect(drift).toEqual({
      scheduleId: 's1',
      from: 1618,
      to: 1818,
      change: (1818 - 1618) / 1618,
      since: '2026-08-19',
    });
  });

  it('ignores small moves, ranges and thin history', () => {
    const charges = [
      { date: '2026-09-19', amount: -1700 },
      { date: '2026-08-19', amount: -1618 },
    ];
    expect(detectDrift(schedule({}), charges)).toBeNull();
    expect(
      detectDrift(schedule({ _amountOp: 'isbetween' }), [
        { date: '2026-09-19', amount: -3000 },
        { date: '2026-08-19', amount: -3000 },
      ]),
    ).toBeNull();
    expect(
      detectDrift(schedule({}), [{ date: '2026-09-19', amount: -3000 }]),
    ).toBeNull();
  });

  it('falls back to the scheduled amount when every charge is off', () => {
    const drift = detectDrift(schedule({}), [
      { date: '2026-09-19', amount: -2000 },
      { date: '2026-08-19', amount: -2000 },
    ]);
    expect(drift?.from).toBe(1618);
    expect(drift?.since).toBe('2026-08-19');
  });
});

describe('history helpers', () => {
  it('groups newest first and reverses into oldest-first history', () => {
    const grouped = groupCharges([
      { schedule: 's1', date: '2026-07-01', amount: -100 },
      { schedule: 's1', date: '2026-08-01', amount: -120 },
      { schedule: null, date: '2026-08-01', amount: -5 },
    ]);
    expect(grouped.get('s1')?.map(c => c.date)).toEqual([
      '2026-08-01',
      '2026-07-01',
    ]);
    expect(chargeHistory(grouped.get('s1'))).toEqual([100, 120]);
    expect(chargedBetween(grouped, '2026-07-15', '2026-09-01')).toBe(120);
  });

  it('reads rising outflows and falling income as wrong', () => {
    expect(historyWentWrong([100, 120], false)).toBe(true);
    expect(historyWentWrong([100, 100], false)).toBe(false);
    expect(historyWentWrong([100, 90], true)).toBe(true);
  });
});

describe('occurrencesBetween', () => {
  it('counts a one-off date inside the window unless already paid', () => {
    const s = schedule({});
    expect(
      occurrencesBetween(s, 'upcoming', '2026-09-17', '2026-10-17'),
    ).toEqual(['2026-09-20']);
    expect(occurrencesBetween(s, 'paid', '2026-09-17', '2026-10-17')).toEqual(
      [],
    );
    expect(
      occurrencesBetween(
        schedule({ completed: true }),
        'completed',
        '2026-09-17',
        '2026-10-17',
      ),
    ).toEqual([]);
  });

  it('walks a recurring schedule through the window', () => {
    const s = schedule({
      _conditions: [
        {
          op: 'isapprox',
          field: 'date',
          value: { frequency: 'weekly', start: '2026-09-20', interval: 1 },
        },
      ] as ScheduleEntity['_conditions'],
    });
    expect(
      occurrencesBetween(s, 'upcoming', '2026-09-17', '2026-10-10'),
    ).toEqual(['2026-09-20', '2026-09-27', '2026-10-04']);
  });
});

describe('scheduleCoverage', () => {
  test('reports the budgeted spending no schedule projects', () => {
    expect(scheduleCoverage(110_000, 420_000)).toEqual({
      covered: 110_000 / 420_000,
      uncovered: 310_000,
    });
  });

  test('a fully scheduled budget is covered, with nothing left over', () => {
    expect(scheduleCoverage(420_000, 420_000)).toEqual({
      covered: 1,
      uncovered: 0,
    });
  });

  test('scheduling more than is budgeted still caps at covered', () => {
    expect(scheduleCoverage(500_000, 420_000)).toEqual({
      covered: 1,
      uncovered: 0,
    });
  });

  test('nothing budgeted yet means there is nothing to be short of', () => {
    expect(scheduleCoverage(0, 0)).toBeNull();
    expect(scheduleCoverage(110_000, 0)).toBeNull();
  });
});
