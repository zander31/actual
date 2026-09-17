import { findLeaks, reconcile } from './reconcileMath';
import type { LeakRow } from './reconcileMath';

const onBudget = new Set(['checking', 'savings']);

const row = (
  over: Partial<LeakRow> & { id: string; amount: number },
): LeakRow => ({
  date: '2026-09-10',
  payeeName: 'Someone',
  accountName: 'Checking',
  transferAccount: null,
  ...over,
});

describe('findLeaks', () => {
  test('a transfer between two on-budget accounts is not a leak', () => {
    const rows = [
      row({ id: 'out', amount: -50_000, transferAccount: 'savings' }),
      row({ id: 'in', amount: 50_000, transferAccount: 'checking' }),
    ];
    expect(findLeaks(rows, onBudget)).toEqual([]);
  });

  test('a transfer to an untracked account is a leak, and is named as one', () => {
    const leaks = findLeaks(
      [row({ id: 'vault', amount: -120_000, transferAccount: 'disney-vault' })],
      onBudget,
    );
    expect(leaks).toHaveLength(1);
    expect(leaks[0].kind).toBe('off-budget-transfer');
    expect(leaks[0].amount).toBe(-120_000);
  });

  test('an uncategorised transaction is a leak', () => {
    const leaks = findLeaks([row({ id: 'x', amount: -3_000 })], onBudget);
    expect(leaks[0].kind).toBe('uncategorised');
  });

  test('leaks come back biggest first', () => {
    const leaks = findLeaks(
      [
        row({ id: 'small', amount: -1_000 }),
        row({ id: 'big', amount: 90_000 }),
        row({ id: 'mid', amount: -40_000 }),
      ],
      onBudget,
    );
    expect(leaks.map(l => l.id)).toEqual(['big', 'mid', 'small']);
  });
});

describe('reconcile', () => {
  test('a budget that matches the bank has no gap', () => {
    const r = reconcile({
      inTheBank: 250_000,
      envelopeBalances: [100_000, 50_000],
      toBudget: 100_000,
      buffered: 0,
      leaks: [],
    });
    expect(r.gap).toBe(0);
    expect(r.explained).toBe(true);
  });

  // The savings double-count, in numbers: $1,200 moved to an untracked vault
  // leaves the envelopes still holding it.
  test('money moved out of the budget shows as a gap the leaks explain', () => {
    const leaks = findLeaks(
      [row({ id: 'vault', amount: -120_000, transferAccount: 'disney-vault' })],
      onBudget,
    );
    const r = reconcile({
      inTheBank: 130_000,
      envelopeBalances: [120_000, 30_000],
      toBudget: 100_000,
      buffered: 0,
      leaks,
    });
    expect(r.inTheBudget).toBe(250_000);
    expect(r.gap).toBe(-120_000);
    expect(r.explained).toBe(true);
  });

  test('held-back income counts as money the budget is holding', () => {
    const r = reconcile({
      inTheBank: 300_000,
      envelopeBalances: [100_000],
      toBudget: 150_000,
      buffered: 50_000,
      leaks: [],
    });
    expect(r.gap).toBe(0);
  });

  test('a gap the leaks do not add up to is reported as unexplained', () => {
    const r = reconcile({
      inTheBank: 0,
      envelopeBalances: [100_000],
      toBudget: 0,
      buffered: 0,
      leaks: [],
    });
    expect(r.gap).toBe(-100_000);
    expect(r.explained).toBe(false);
  });

  test('a cent of rounding still counts as explained', () => {
    const r = reconcile({
      inTheBank: 99_999,
      envelopeBalances: [100_000],
      toBudget: 0,
      buffered: 0,
      leaks: [],
    });
    expect(r.explained).toBe(true);
  });
});
