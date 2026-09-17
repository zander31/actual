// Fork: the accounts overview, set as an instrument. The net position is the
// page's figure and follows the curve under the pointer; each account is a
// ruled row carrying its own recent history, its share of what you hold, its
// balance and how far that balance has moved this month.
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { tsToRelativeTime } from '@actual-app/core/shared/util';
import type { AccountEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { Page } from '#components/Page';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { useOffBudgetAccounts } from '#hooks/useOffBudgetAccounts';
import { useOnBudgetAccounts } from '#hooks/useOnBudgetAccounts';
import { useQuery } from '#hooks/useQuery';

import {
  balancesOn,
  normalizeChanges,
  rangeStart,
  sampleDays,
  summarizeAccounts,
} from './balancesMath';
import type { AccountSummary, BalanceRange, DayChange } from './balancesMath';
import {
  Delta,
  instrumentPage,
  Meter,
  PageHero,
  PillTabs,
  ScrubChart,
  SectionHeader,
  Sparkline,
} from './primitives';

const RANGES: ReadonlyArray<BalanceRange> = ['1W', '1M', '3M', 'YTD', 'ALL'];

/** How many weeks of history a row's sparkline covers. */
const SPARK_WEEKS = 12;

type Share = { percent: number; debt: boolean };

function AccountRow({
  account,
  summary,
  share,
  loading,
  compact,
}: {
  account: AccountEntity;
  summary: AccountSummary | undefined;
  share: Share;
  loading: boolean;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();

  const balance = summary?.balance ?? 0;
  const change = summary?.monthChange ?? 0;
  const history = summary?.history ?? [];
  const changeInk =
    change > 0
      ? theme.noticeText
      : change < 0
        ? theme.errorText
        : theme.pageTextSubdued;
  const sparkUp =
    history.length < 2 || history[history.length - 1] >= history[0];

  const note = account.bank
    ? account.last_sync
      ? t('Bank connected · synced {{when}}', {
          when: tsToRelativeTime(account.last_sync, locale),
        })
      : t('Bank connected')
    : t('Not linked to a bank');

  const percentLabel = share.percent.toFixed(1);

  return (
    <Link
      to={`/accounts/${account.id}`}
      className={css({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? 14 : 22,
        padding: compact ? '14px 4px' : '17px 4px',
        minHeight: 44,
        textDecoration: 'none',
        color: 'inherit',
        borderBottom: `1px solid ${theme.tableBorder}`,
        transition: 'background-color .14s ease',
        ':hover': { backgroundColor: theme.tableRowBackgroundHover },
        ':focus-visible': {
          outline: `2px solid ${theme.formInputBorderSelected}`,
          outlineOffset: -2,
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      })}
    >
      <View
        style={{
          gap: 2,
          minWidth: 0,
          ...(compact ? { flex: 1 } : { width: 300, flexShrink: 0 }),
        }}
      >
        <Text
          style={{
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '-0.018em',
            color: theme.pageText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {account.name}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: theme.pageTextSubdued,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {note}
        </Text>
      </View>

      {!compact && (
        <>
          <View style={{ width: 110, flexShrink: 0 }}>
            <Sparkline
              values={history}
              width={100}
              height={30}
              color={sparkUp ? theme.reportsChartFill : theme.errorBorder}
            />
          </View>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Meter
              percent={share.percent}
              color={share.debt ? theme.errorBorder : theme.reportsChartFill}
            />
            <Text
              style={{
                ...styles.tnum,
                width: 112,
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 500,
                color: theme.pageTextSubdued,
                whiteSpace: 'nowrap',
              }}
            >
              {loading
                ? ''
                : share.debt
                  ? t('{{percent}}% of debts', { percent: percentLabel })
                  : t('{{percent}}% of assets', { percent: percentLabel })}
            </Text>
          </View>
        </>
      )}

      <View
        style={{
          alignItems: 'flex-end',
          gap: 1,
          flexShrink: 0,
          ...(compact ? {} : { width: 150 }),
        }}
      >
        <Text
          style={{
            ...styles.tnum,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            color: balance < 0 ? theme.errorText : theme.pageText,
          }}
        >
          {loading ? ' ' : format(balance, 'financial')}
        </Text>
        <Text
          style={{
            ...styles.tnum,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-0.008em',
            whiteSpace: 'nowrap',
            color: changeInk,
          }}
        >
          {loading
            ? ' '
            : t('{{amount}} this month', {
                amount: format(change, 'financial-with-sign'),
              })}
        </Text>
      </View>
    </Link>
  );
}

export function BalancesPage() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const format = useFormat();
  const locale = useLocale();
  const navigate = useNavigate();
  const { data: onBudget = [] } = useOnBudgetAccounts();
  const { data: offBudget = [] } = useOffBudgetAccounts();

  const [range, setRange] = useState<BalanceRange>('3M');
  const [scrub, setScrub] = useState<number | null>(null);

  // One live query: the net change per open account per day. The chart, the
  // sparklines, the shares and the monthly changes are all derived from it.
  const { data, isLoading } = useQuery<DayChange>(
    () =>
      q('transactions')
        .filter({ 'account.closed': false })
        .options({ splits: 'none' })
        .groupBy(['account', 'date'])
        .select(['account', 'date', { amount: { $sum: '$amount' } }]),
    [],
  );

  const today = monthUtils.currentDay();
  const accountKey = [...onBudget, ...offBudget].map(a => a.id).join(',');

  const changes = useMemo(
    () =>
      normalizeChanges(
        data ?? [],
        new Set(accountKey ? accountKey.split(',') : []),
        today,
      ),
    [data, accountKey, today],
  );

  const summaries = useMemo(() => {
    const start = monthUtils.subWeeks(today, SPARK_WEEKS);
    const days = Array.from({ length: SPARK_WEEKS + 1 }, (_, i) =>
      i === SPARK_WEEKS ? today : monthUtils.addWeeks(start, i),
    );
    return summarizeAccounts(changes, today, days);
  }, [changes, today]);

  const { assets, debts } = useMemo(() => {
    let assets = 0;
    let debts = 0;
    for (const s of summaries.values()) {
      if (s.balance > 0) assets += s.balance;
      else debts -= s.balance;
    }
    return { assets, debts };
  }, [summaries]);

  const points = useMemo(() => {
    const start = rangeStart(range, today, changes[0]?.date ?? null);
    const days = sampleDays(start, today);
    const values = balancesOn(changes, days);
    const spansYears = start.slice(0, 4) !== today.slice(0, 4);
    return days.map((day, i) => ({
      label: monthUtils.format(
        day,
        spansYears ? 'd MMM yyyy' : 'd MMM',
        locale,
      ),
      value: values[i],
    }));
  }, [changes, range, today, locale]);

  const periods: Record<BalanceRange, string> = {
    '1W': t('past week'),
    '1M': t('past month'),
    '3M': t('past 3 months'),
    YTD: t('year to date'),
    ALL: t('all time'),
  };

  const shown = points.length
    ? points[Math.min(scrub ?? points.length - 1, points.length - 1)]
    : null;
  const base = points[0]?.value ?? 0;
  const diff = (shown?.value ?? 0) - base;
  const percent =
    base !== 0 ? `${((diff / Math.abs(base)) * 100).toFixed(1)}%` : undefined;

  const shareOf = (account: AccountEntity): Share => {
    const balance = summaries.get(account.id)?.balance ?? 0;
    if (balance < 0) {
      return { percent: debts ? (-balance / debts) * 100 : 0, debt: true };
    }
    return { percent: assets ? (balance / assets) * 100 : 0, debt: false };
  };

  const groupTotal = (accounts: AccountEntity[]) =>
    accounts.reduce((sum, a) => sum + (summaries.get(a.id)?.balance ?? 0), 0);

  const row = (account: AccountEntity) => (
    <AccountRow
      key={account.id}
      account={account}
      summary={summaries.get(account.id)}
      share={shareOf(account)}
      loading={isLoading}
      compact={isNarrowWidth}
    />
  );

  return (
    <Page header={isNarrowWidth ? t('Accounts') : null} padding={0}>
      <View
        style={{
          ...instrumentPage,
          ...(isNarrowWidth ? { padding: '20px 16px 60px' } : {}),
          flexShrink: 0,
        }}
      >
        <PageHero
          label={
            scrub == null || !shown
              ? t('All accounts')
              : t('All accounts on {{date}}', { date: shown.label })
          }
          figure={isLoading || !shown ? ' ' : format(shown.value, 'financial')}
          action={
            // No transfer flow exists as a page; the primary action keeps the
            // overview's existing way into every transaction instead.
            <Button variant="primary" onPress={() => navigate('/accounts')}>
              <Trans>All transactions</Trans>
            </Button>
          }
        >
          {!isLoading && shown ? (
            <Delta
              up={diff >= 0}
              amount={format(diff, 'financial-with-sign')}
              percent={percent}
              period={
                scrub == null
                  ? periods[range]
                  : t('since {{date}}', { date: points[0].label })
              }
            />
          ) : null}
        </PageHero>

        <ScrubChart
          key={range}
          points={points}
          onScrub={setScrub}
          height={isNarrowWidth ? 180 : 230}
        />

        <PillTabs
          label={t('Chart range')}
          value={range}
          onChange={value => {
            setScrub(null);
            setRange(value);
          }}
          options={RANGES.map(value => ({ value, label: value }))}
          style={{ marginTop: 10 }}
        />

        {onBudget.length > 0 && (
          <>
            <SectionHeader
              label={t('On budget')}
              total={
                isLoading ? null : format(groupTotal(onBudget), 'financial')
              }
            />
            <View style={{ flexShrink: 0 }}>{onBudget.map(row)}</View>
          </>
        )}
        {offBudget.length > 0 && (
          <>
            <SectionHeader
              label={t('Off budget')}
              total={
                isLoading ? null : format(groupTotal(offBudget), 'financial')
              }
              style={{ marginTop: 30 }}
            />
            <View style={{ flexShrink: 0 }}>{offBudget.map(row)}</View>
          </>
        )}
      </View>
    </Page>
  );
}
