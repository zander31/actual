// Envelope budgeting has exactly one invariant, and the fork never showed it:
//
//   sum of every envelope balance  +  left to assign  +  held for next month
//     ==  the money actually sitting in the on-budget accounts
//
// When the two sides disagree, the budget is claiming money the bank does not
// have (or hiding money it does). Every cent of the difference is a transaction
// on an on-budget account that no category ever saw, so the difference can
// always be named rather than guessed at.
//
// This is the shape the "money in savings counts twice" problem takes: move
// cash to an account the budget does not track and the checking balance drops
// while the envelope that was meant to hold it stays full. Nothing in the app
// said so. All amounts are integer cents.

/** A transaction on an on-budget account that no category accounts for. */
export type Leak = {
  id: string;
  date: string;
  amount: number;
  payeeName: string | null;
  accountName: string;
  /** A move to an account the budget does not track, or simply uncategorised. */
  kind: 'off-budget-transfer' | 'uncategorised';
};

export type LeakRow = {
  id: string;
  date: string;
  amount: number;
  payeeName?: string | null;
  accountName?: string | null;
  /** The account on the other side, when this is a transfer. */
  transferAccount?: string | null;
};

/**
 * Which uncategorised transactions actually move money out of the budget.
 *
 * A transfer between two on-budget accounts has both legs inside the total, so
 * the pair nets to zero and is no leak at all — it is the household moving its
 * own cash between its own pockets. A transfer to an account the budget does
 * not track leaves only one leg behind, and that leg is a real loss of budgeted
 * money that no envelope was asked to pay for.
 */
export function findLeaks(
  rows: readonly LeakRow[],
  onBudgetAccountIds: ReadonlySet<string>,
): Leak[] {
  return rows
    .filter(
      r => !r.transferAccount || !onBudgetAccountIds.has(r.transferAccount),
    )
    .map(r => ({
      id: r.id,
      date: r.date,
      amount: r.amount,
      payeeName: r.payeeName ?? null,
      accountName: r.accountName ?? '',
      kind: r.transferAccount
        ? ('off-budget-transfer' as const)
        : ('uncategorised' as const),
    }))
    .sort(
      (a, b) =>
        Math.abs(b.amount) - Math.abs(a.amount) || a.date.localeCompare(b.date),
    );
}

export type Reconciliation = {
  /** What the on-budget accounts hold, as of the month being reconciled. */
  inTheBank: number;
  /** Envelope balances + left to assign + held back. */
  inTheBudget: number;
  /** Bank minus budget. Negative: the budget claims money that is gone. */
  gap: number;
  /** The transactions that make up the gap, largest first. */
  leaks: Leak[];
  /** Whether the named leaks account for the whole gap. */
  explained: boolean;
};

export function reconcile({
  inTheBank,
  envelopeBalances,
  toBudget,
  buffered,
  leaks,
}: {
  inTheBank: number;
  envelopeBalances: readonly number[];
  toBudget: number;
  buffered: number;
  leaks: Leak[];
}): Reconciliation {
  const inTheBudget =
    envelopeBalances.reduce((sum, b) => sum + b, 0) + toBudget + buffered;
  const gap = inTheBank - inTheBudget;
  const named = leaks.reduce((sum, l) => sum + l.amount, 0);
  return {
    inTheBank,
    inTheBudget,
    gap,
    leaks,
    // A cent of rounding is not a story worth telling.
    explained: Math.abs(gap - named) <= 1,
  };
}
