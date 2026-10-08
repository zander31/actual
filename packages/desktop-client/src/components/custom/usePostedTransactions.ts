import { useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';

import { useQuery } from '#hooks/useQuery';

import { EARLY_POST_DAYS } from './forecastMath';
import type { PostedTxn } from './forecastMath';

type PostedRow = {
  date: string;
  amount: number;
  schedule: string | null;
  payeeName: string | null;
  imported_payee: string | null;
  transferAcct: string | null;
};

/**
 * What buildCalendarDays needs for `ids` over `start`..`end`: every posted cent
 * before `start`, and the transactions from EARLY_POST_DAYS before it on. Live,
 * so a bank sync or an edit re-renders without a reload. `null` until loaded.
 */
export function usePostedTransactions(
  ids: string[],
  start: string,
  end: string,
): { opening: number; posted: PostedTxn[] } | null {
  const { data: openingRows } = useQuery<{ amount: number | null }>(
    () =>
      ids.length
        ? q('transactions')
            .filter({ account: { $oneof: ids }, date: { $lt: start } })
            .options({ splits: 'none' })
            .select([{ amount: { $sum: '$amount' } }])
        : null,
    [ids, start],
  );
  const { data: postedRows } = useQuery<PostedRow>(
    () =>
      ids.length
        ? q('transactions')
            .filter({
              account: { $oneof: ids },
              date: {
                $gte: monthUtils.subDays(start, EARLY_POST_DAYS),
                $lte: end,
              },
            })
            .options({ splits: 'inline' })
            .select([
              'date',
              'amount',
              'schedule',
              { payeeName: 'payee.name' },
              'imported_payee',
              { transferAcct: 'payee.transfer_acct' },
            ])
        : null,
    [ids, start, end],
  );

  return useMemo(
    () =>
      openingRows && postedRows
        ? {
            opening: openingRows[0]?.amount ?? 0,
            posted: postedRows
              // moves between the accounts on view net to nothing; don't list them
              .filter(r => !r.transferAcct || !ids.includes(r.transferAcct))
              .map(r => ({
                date: r.date,
                amount: r.amount,
                payee: r.payeeName || r.imported_payee || '',
                schedule: r.schedule,
              })),
          }
        : null,
    [openingRows, postedRows, ids],
  );
}
