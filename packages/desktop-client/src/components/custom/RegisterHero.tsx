// Fork: the top of an account register, set as an instrument. The account's
// balance is the figure, its running balance is the curve under it, and
// hovering the curve walks the figure back through time. The toolbar row
// (search, filter and the register's own controls) sits beside the range pills.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { Query } from '@actual-app/core/shared/query';
import { css } from '@emotion/css';
import { startOfYear, subMonths, subWeeks } from 'date-fns';
import { useWindowSize } from 'usehooks-ts';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useQuery } from '#hooks/useQuery';
import { useSheetValue } from '#hooks/useSheetValue';
import * as queries from '#queries';
import type { Binding } from '#spreadsheet';

import { Delta, HeroNumber, PillTabs, ScrubChart } from './primitives';
import type { ChartPoint } from './primitives';

type Range = '1W' | '1M' | '3M' | 'YTD' | 'ALL';

/** The most points the curve draws; longer histories keep each bucket's close. */
const MAX_POINTS = 240;

function rangeStart(range: Range): string | null {
  const now = new Date();
  switch (range) {
    case '1W':
      return monthUtils.dayFromDate(subWeeks(now, 1));
    case '1M':
      return monthUtils.dayFromDate(subMonths(now, 1));
    case '3M':
      return monthUtils.dayFromDate(subMonths(now, 3));
    case 'YTD':
      return monthUtils.dayFromDate(startOfYear(now));
    default:
      return null;
  }
}

type RegisterHeroProps = {
  accountId?: string;
  balanceQuery: { name: `balance-query-${string}`; query: Query };
  /** The account name row — editable name, notes, sync status. */
  label: ReactNode;
  showChart: boolean;
  showExtraBalances: boolean;
  onToggleExtraBalances: () => void;
  /** Cleared / uncleared / selected / filtered balance chips. */
  extras?: ReactNode;
  action?: ReactNode;
  toolbar?: ReactNode;
};

export function RegisterHero({
  accountId,
  balanceQuery,
  label,
  showChart,
  showExtraBalances,
  onToggleExtraBalances,
  extras,
  action,
  toolbar,
}: RegisterHeroProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const { height: windowHeight = 900 } = useWindowSize();
  const [range, setRange] = useState<Range>('1M');
  const [scrub, setScrub] = useState<number | null>(null);

  const balance =
    useSheetValue<'balance', `balance-query-${string}`>({
      ...balanceQuery,
      value: 0,
    } as Binding<'balance', `balance-query-${string}`>) ?? 0;

  const start = rangeStart(range);
  const { data: daily } = useQuery<{ date: string; amount: number }>(() => {
    let query = queries.transactions(accountId);
    if (start) {
      query = query.filter({ date: { $gte: start } });
    }
    return query
      .groupBy(['date'])
      .select(['date', { amount: { $sum: '$amount' } }]);
  }, [accountId, start]);

  const points = useMemo<ChartPoint[]>(() => {
    if (!daily) {
      return [];
    }
    const byDay = new Map(daily.map(d => [d.date, d.amount]));
    const today = monthUtils.currentDay();
    const days = [...byDay.keys()].sort();
    const first = start ?? days[0] ?? today;
    const lastTxn = days[days.length - 1];
    const last = lastTxn && lastTxn > today ? lastTxn : today;
    if (first > last) {
      return [];
    }

    // The balance before the range is whatever the range doesn't explain.
    let running = balance - daily.reduce((sum, d) => sum + d.amount, 0);
    const longSpan = monthUtils.differenceInCalendarDays(last, first) > 400;
    const labelFormat = longSpan ? 'd MMM yyyy' : 'd MMMM';
    const series: ChartPoint[] = [
      {
        label: monthUtils.format(
          monthUtils.subDays(first, 1),
          labelFormat,
          locale,
        ),
        value: running,
      },
    ];
    for (const day of monthUtils.dayRangeInclusive(first, last)) {
      running += byDay.get(day) ?? 0;
      series.push({
        label: monthUtils.format(day, labelFormat, locale),
        value: running,
      });
    }
    if (series.length <= MAX_POINTS) {
      return series;
    }
    const step = series.length / MAX_POINTS;
    const sampled: ChartPoint[] = [series[0]];
    for (let i = 1; i < MAX_POINTS; i++) {
      sampled.push(series[Math.min(series.length - 1, Math.round(i * step))]);
    }
    sampled[sampled.length - 1] = series[series.length - 1];
    return sampled;
  }, [daily, balance, start, locale]);

  const scrubbing = scrub != null && scrub < points.length;
  const shown = scrubbing ? points[scrub] : null;
  const figure = shown ? shown.value : balance;
  const base = points[0]?.value ?? balance;
  const diff = figure - base;
  const percent =
    base !== 0 ? `${((diff / Math.abs(base)) * 100).toFixed(1)}%` : undefined;
  const trendUp = (points[points.length - 1]?.value ?? balance) >= base;

  const periods: Record<Range, string> = {
    '1W': t('past week'),
    '1M': t('past month'),
    '3M': t('past 3 months'),
    YTD: t('year to date'),
    ALL: t('all time'),
  };
  const period = shown
    ? t('since {{date}}', { date: points[0].label })
    : periods[range];

  const chartHeight = windowHeight < 760 ? 120 : windowHeight < 940 ? 170 : 230;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 6, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 22,
            }}
          >
            {label}
            {shown ? (
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: '-0.008em',
                  color: theme.pageTextSubdued,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('on {{date}}', { date: shown.label })}
              </Text>
            ) : null}
          </View>
          <button
            type="button"
            data-testid="account-balance"
            aria-expanded={showExtraBalances}
            title={
              showExtraBalances
                ? t('Hide cleared and uncleared totals')
                : t('Show cleared and uncleared totals')
            }
            onClick={onToggleExtraBalances}
            className={css({
              all: 'unset',
              alignSelf: 'flex-start',
              cursor: 'pointer',
              borderRadius: 8,
              ':focus-visible': {
                outline: `2px solid ${theme.formInputBorderSelected}`,
                outlineOffset: 2,
              },
            })}
          >
            <PrivacyFilter>
              <HeroNumber color={figure < 0 ? theme.errorText : theme.pageText}>
                {format(figure, 'financial')}
              </HeroNumber>
            </PrivacyFilter>
          </button>
          {points.length > 1 || extras ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {points.length > 1 ? (
                <PrivacyFilter>
                  <Delta
                    up={diff >= 0}
                    amount={`${diff >= 0 ? '+' : ''}${format(diff, 'financial')}`}
                    percent={percent}
                    period={period}
                  />
                </PrivacyFilter>
              ) : null}
              {extras}
            </View>
          ) : null}
        </View>
        {action ? <View style={{ flexShrink: 0 }}>{action}</View> : null}
      </View>

      {showChart ? (
        <ScrubChart
          key={`${accountId}-${range}`}
          points={points}
          height={chartHeight}
          color={trendUp ? theme.reportsChartFill : theme.errorBorder}
          onScrub={setScrub}
        />
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginTop: showChart ? 10 : 18,
          flexWrap: 'wrap',
        }}
      >
        {showChart ? (
          <PillTabs<Range>
            label={t('Chart range')}
            value={range}
            onChange={value => {
              setScrub(null);
              setRange(value);
            }}
            options={[
              { value: '1W', label: t('1W') },
              { value: '1M', label: t('1M') },
              { value: '3M', label: t('3M') },
              { value: 'YTD', label: t('YTD') },
              { value: 'ALL', label: t('ALL') },
            ]}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <View
          style={{
            ...styles.tnum,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {toolbar}
        </View>
      </View>
    </View>
  );
}
