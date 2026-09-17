// Fork: the top of the reports dashboard. Net worth leads as the page's figure
// with a scrubbable curve, then this month against last as four tiles, then
// where the month's spending went. The user's own widgets follow beneath it,
// untouched, in `Overview`.
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import * as d from 'date-fns';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { createSpreadsheet as netWorthSpreadsheet } from '#components/reports/spreadsheets/net-worth-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useSyncedPref } from '#hooks/useSyncedPref';

import {
  Delta,
  Direction,
  PageHero,
  PillTabs,
  ScrubChart,
  sectionLabel,
  StatusChip,
} from './primitives';

// ── Net worth ────────────────────────────────────────────────────────────────

type Range = '1W' | '1M' | '3M' | 'YTD' | 'ALL';

type NetWorthData = Parameters<
  Parameters<ReturnType<typeof netWorthSpreadsheet>>[1]
>[0];

/** Where a range starts, how it is bucketed, and how many points it keeps. */
function rangeSpec(range: Range, earliest: string | null) {
  const today = monthUtils.currentDay();
  const daily = (start: string) => ({
    start,
    interval: 'Daily' as const,
    keep: monthUtils.differenceInCalendarDays(today, start) + 1,
  });
  switch (range) {
    case '1W':
      return daily(monthUtils.subDays(today, 7));
    case '1M':
      return daily(monthUtils.dayFromDate(d.subMonths(d.parseISO(today), 1)));
    case '3M':
      return daily(monthUtils.dayFromDate(d.subMonths(d.parseISO(today), 3)));
    case 'YTD':
      return daily(`${today.slice(0, 4)}-01-01`);
    default:
      return {
        start: earliest ?? today,
        interval: 'Monthly' as const,
        keep: Infinity,
      };
  }
}

function NetWorthHero({ action }: { action?: ReactNode }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const [_firstDayOfWeekIdx] = useSyncedPref('firstDayOfWeekIdx');
  const firstDayOfWeekIdx = _firstDayOfWeekIdx || '0';
  const { data: accounts = [] } = useAccounts();

  const [range, setRange] = useState<Range>('3M');
  const [scrub, setScrub] = useState<number | null>(null);
  const [earliest, setEarliest] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void send('get-earliest-transaction').then(tx => {
      if (!cancelled && tx) setEarliest(tx.date);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const spec = rangeSpec(range, earliest);
  const params = useMemo(
    () =>
      netWorthSpreadsheet(
        spec.start,
        monthUtils.currentDay(),
        accounts,
        [],
        'and',
        locale,
        spec.interval,
        firstDayOfWeekIdx,
        format,
      ),
    [spec.start, spec.interval, accounts, locale, firstDayOfWeekIdx, format],
  );
  const data = useReport<NetWorthData>('net_worth', params);

  const points = useMemo(() => {
    const all = data?.graphData.data ?? [];
    const kept = Number.isFinite(spec.keep) ? all.slice(-spec.keep) : all;
    return kept.map(p => ({ label: p.date, value: p.y }));
  }, [data, spec.keep]);

  const periods: Record<Range, string> = {
    '1W': t('past week'),
    '1M': t('past month'),
    '3M': t('past 3 months'),
    YTD: t('year to date'),
    ALL: t('all time'),
  };

  const i =
    points.length === 0
      ? null
      : Math.min(scrub ?? points.length - 1, points.length - 1);
  const base = points[0]?.value ?? 0;
  const value = i == null ? null : points[i].value;
  const diff = value == null ? 0 : value - base;

  return (
    <View style={{ flexShrink: 0 }}>
      <PageHero
        label={
          scrub != null && i != null
            ? t('Net worth on {{date}}', { date: points[i].label })
            : t('Net worth')
        }
        figure={
          <PrivacyFilter>
            {value == null ? '—' : format(value, 'financial')}
          </PrivacyFilter>
        }
        action={action}
      >
        {value != null && points.length > 1 ? (
          <PrivacyFilter>
            <Delta
              up={diff >= 0}
              amount={format(Math.abs(diff), 'financial')}
              percent={
                base > 0
                  ? `${((Math.abs(diff) / base) * 100).toFixed(1)}%`
                  : undefined
              }
              period={
                scrub != null
                  ? t('since {{date}}', { date: points[0].label })
                  : periods[range]
              }
            />
          </PrivacyFilter>
        ) : null}
      </PageHero>
      <ScrubChart
        key={range}
        points={points}
        onScrub={index => setScrub(index)}
      />
      <PillTabs<Range>
        label={t('Net worth range')}
        value={range}
        onChange={r => {
          setScrub(null);
          setRange(r);
        }}
        options={[
          { value: '1W', label: t('1W') },
          { value: '1M', label: t('1M') },
          { value: '3M', label: t('3M') },
          { value: 'YTD', label: t('YTD') },
          { value: 'ALL', label: t('ALL') },
        ]}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

// ── This month against last ──────────────────────────────────────────────────

type MonthCells = Map<string, number>;

const HISTORY = 6;

/** The budget sheet's cells for each of the last six months, oldest first. */
function useMonthCells() {
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const [months, setMonths] = useState<
    Array<{ month: string; cells: MonthCells }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    const current = monthUtils.currentMonth();
    const list = Array.from({ length: HISTORY }, (_, k) =>
      monthUtils.subMonths(current, HISTORY - 1 - k),
    );
    void Promise.all(
      list.map(async month => {
        const cells: MonthCells = new Map();
        try {
          const values =
            budgetType === 'tracking'
              ? await send('tracking-budget-month', { month })
              : await send('envelope-budget-month', { month });
          for (const cell of values) {
            const key = cell.name.slice(cell.name.indexOf('!') + 1);
            cells.set(key, Number(cell.value) || 0);
          }
        } catch {
          // A month the budget has not been created for reads as empty.
        }
        return { month, cells };
      }),
    ).then(result => {
      if (!cancelled) setMonths(result);
    });
    return () => {
      cancelled = true;
    };
  }, [budgetType]);

  return months;
}

type Stat = {
  label: string;
  figure: string;
  history: number[];
  diff: number;
  /** The change, already formatted, without a sign. */
  change: string;
  upIsGood: boolean;
};

function StatCard({ stat, period }: { stat: Stat; period: string }) {
  const { t } = useTranslation();
  const unchanged = stat.diff === 0;
  const good = unchanged || stat.diff > 0 === stat.upIsGood;
  const ink = unchanged
    ? theme.pageTextSubdued
    : good
      ? theme.noticeText
      : theme.errorText;
  const stroke = good ? theme.reportsChartFill : theme.errorBorder;

  const h = stat.history;
  const lo = Math.min(...h);
  const hi = Math.max(...h);
  const span = hi - lo || 1;
  const spark = h
    .map((v, k) => {
      const x = (k / Math.max(1, h.length - 1)) * 220;
      const y = hi === lo ? 24 : 46 - ((v - lo) / span) * 44;
      return `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <View
      style={{
        backgroundColor: theme.cardBackground,
        borderRadius: 16,
        boxShadow: `inset 0 0 0 1px ${theme.tableBorder}`,
        padding: '18px 20px 16px',
        gap: 4,
        minWidth: 0,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: theme.pageTextSubdued,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {stat.label}
      </Text>
      <PrivacyFilter>
        <Text
          style={{
            ...styles.tnum,
            fontSize: 30,
            fontWeight: 560,
            letterSpacing: '-0.032em',
            lineHeight: 1.08,
            whiteSpace: 'nowrap',
            color: theme.pageText,
          }}
        >
          {stat.figure}
        </Text>
      </PrivacyFilter>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        {unchanged ? null : <Direction up={stat.diff > 0} color={ink} />}
        <PrivacyFilter>
          <Text
            style={{
              ...styles.tnum,
              fontSize: 13,
              fontWeight: 650,
              letterSpacing: '-0.008em',
              whiteSpace: 'nowrap',
              color: ink,
            }}
          >
            {unchanged ? t('unchanged') : stat.change}
          </Text>
        </PrivacyFilter>
        <Text
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: theme.pageTextSubdued,
            whiteSpace: 'nowrap',
          }}
        >
          {period}
        </Text>
      </View>
      <svg
        width="100%"
        height="48"
        viewBox="0 0 220 48"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ display: 'block', marginTop: 10 }}
      >
        {h.length > 1 ? (
          <path
            d={spark}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </View>
  );
}

function MonthStats({
  months,
  current,
  previous,
}: {
  months: Array<{ month: string; cells: MonthCells }>;
  current: string;
  previous: string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const { isNarrowWidth } = useResponsive();

  const income = months.map(m => m.cells.get('total-income') ?? 0);
  const spent = months.map(m => -(m.cells.get('total-spent') ?? 0));
  const left = income.map((v, k) => v - spent[k]);
  const kept = income.map((v, k) => (v > 0 ? (left[k] / v) * 100 : 0));
  const n = months.length;

  const money = (history: number[], label: string, upIsGood: boolean) => {
    const now = history[n - 1];
    const before = history[n - 2];
    const diff = now - before;
    const pct =
      before !== 0
        ? ` (${((Math.abs(diff) / Math.abs(before)) * 100).toFixed(1)}%)`
        : '';
    return {
      label,
      figure: format(now, 'financial'),
      history,
      diff,
      change: `${format(Math.abs(diff), 'financial')}${pct}`,
      upIsGood,
    };
  };

  const keptDiff = Math.round((kept[n - 1] - kept[n - 2]) * 10) / 10;
  const stats: Stat[] = [
    money(left, t('Left over this month'), true),
    money(spent, t('Spent this month'), false),
    money(income, t('Income received'), true),
    {
      label: t('Kept, not spent'),
      figure: income[n - 1] > 0 ? `${kept[n - 1].toFixed(1)}%` : '—',
      history: kept,
      diff: keptDiff,
      change: t('{{points}} points', { points: Math.abs(keptDiff).toFixed(1) }),
      upIsGood: true,
    },
  ];

  const period = t('vs {{month}}', {
    month: monthUtils.format(previous, 'MMMM', locale),
  });

  return (
    <View
      aria-label={t('{{month}} at a glance', {
        month: monthUtils.format(current, 'MMMM', locale),
      })}
      style={{
        display: 'grid',
        gridTemplateColumns: isNarrowWidth
          ? 'repeat(2, minmax(0, 1fr))'
          : 'repeat(4, minmax(0, 1fr))',
        gap: 14,
        marginTop: 32,
        flexShrink: 0,
      }}
    >
      {stats.map(stat => (
        <StatCard key={stat.label} stat={stat} period={period} />
      ))}
    </View>
  );
}

// ── Where the month went ─────────────────────────────────────────────────────

function WhereItWent({
  months,
  current,
  previous,
}: {
  months: Array<{ month: string; cells: MonthCells }>;
  current: string;
  previous: string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const { isNarrowWidth } = useResponsive();
  const { data: categories } = useCategories();

  const now = months[months.length - 1].cells;
  const before = months[months.length - 2].cells;

  const rows = (categories?.list ?? [])
    .filter(c => !c.is_income)
    .map(c => {
      const amount = -(now.get(`sum-amount-${c.id}`) ?? 0);
      const prior = -(before.get(`sum-amount-${c.id}`) ?? 0);
      const leftover = now.get(`leftover-${c.id}`) ?? 0;
      return {
        id: c.id,
        name: c.name,
        amount,
        change: amount - prior,
        over: leftover < 0 ? -leftover : 0,
      };
    })
    .filter(r => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
  const top = rows[0]?.amount ?? 1;

  const nameWidth = isNarrowWidth ? 120 : 200;
  const amountWidth = isNarrowWidth ? 92 : 130;
  const deltaWidth = isNarrowWidth ? 78 : 120;

  return (
    <View style={{ flexShrink: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          margin: '34px 0 6px',
        }}
      >
        <Text style={{ ...sectionLabel, whiteSpace: 'nowrap' }}>
          {t('Where {{month}} went', {
            month: monthUtils.format(current, 'MMMM', locale),
          })}
        </Text>
        <View
          style={{ flex: 1, height: 1, backgroundColor: theme.tableBorder }}
        />
        <Text
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: theme.pageTextSubdued,
            whiteSpace: 'nowrap',
          }}
        >
          {t('against {{month}}', {
            month: monthUtils.format(previous, 'MMMM', locale),
          })}
        </Text>
      </View>

      {rows.length === 0 ? (
        <Text
          style={{
            padding: '15px 4px',
            fontSize: 15,
            fontWeight: 500,
            color: theme.pageTextLight,
          }}
        >
          <Trans>Nothing has been spent from a category yet this month.</Trans>
        </Text>
      ) : null}

      {rows.map(r => {
        const ink =
          r.change > 0
            ? theme.errorText
            : r.change < 0
              ? theme.noticeText
              : theme.pageTextSubdued;
        const delta =
          r.change === 0
            ? t('unchanged')
            : `${r.change > 0 ? '+' : '−'}${format(Math.abs(r.change), 'financial')}`;
        return (
          <View
            key={r.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: isNarrowWidth ? 12 : 22,
              padding: '15px 4px',
              borderBottom: `1px solid ${theme.tableBorder}`,
            }}
          >
            <View
              style={{
                width: nameWidth,
                flexShrink: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
              }}
            >
              <Text
                title={r.name}
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: '-0.014em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  color: theme.pageText,
                }}
              >
                {r.name}
              </Text>
              {r.over > 0 && !isNarrowWidth ? (
                <PrivacyFilter>
                  <StatusChip tone="warning">
                    {t('Over {{amount}}', {
                      amount: format(r.over, 'financial-no-decimals'),
                    })}
                  </StatusChip>
                </PrivacyFilter>
              ) : null}
            </View>
            <View
              role="img"
              aria-label={
                r.over > 0
                  ? t('{{percent}}% of the largest category, over budget', {
                      percent: Math.round((r.amount / top) * 100),
                    })
                  : t('{{percent}}% of the largest category', {
                      percent: Math.round((r.amount / top) * 100),
                    })
              }
              style={{
                flex: 1,
                minWidth: 0,
                height: 12,
                borderRadius: 6,
                backgroundColor: theme.surfaceSunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 12,
                  width: `${((r.amount / top) * 100).toFixed(1)}%`,
                  borderRadius: 6,
                  backgroundColor:
                    r.over > 0 ? theme.warningBorder : theme.reportsChartFill,
                }}
              />
            </View>
            <PrivacyFilter>
              <Text
                style={{
                  ...styles.tnum,
                  width: amountWidth,
                  flexShrink: 0,
                  textAlign: 'right',
                  fontSize: isNarrowWidth ? 15 : 17,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  color: theme.pageText,
                }}
              >
                {format(r.amount, 'financial')}
              </Text>
            </PrivacyFilter>
            <PrivacyFilter>
              <Text
                style={{
                  ...styles.tnum,
                  width: deltaWidth,
                  flexShrink: 0,
                  textAlign: 'right',
                  fontSize: 13,
                  fontWeight: 650,
                  whiteSpace: 'nowrap',
                  color: ink,
                }}
              >
                {delta}
              </Text>
            </PrivacyFilter>
          </View>
        );
      })}
    </View>
  );
}

// ── The page top ─────────────────────────────────────────────────────────────

export function ReportsInstrument({ action }: { action?: ReactNode }) {
  const months = useMonthCells();
  const current = monthUtils.currentMonth();
  const previous = monthUtils.prevMonth(current);

  return (
    <View style={{ flexShrink: 0 }}>
      <NetWorthHero action={action} />
      {months.length === HISTORY ? (
        <>
          <MonthStats months={months} current={current} previous={previous} />
          <WhereItWent months={months} current={current} previous={previous} />
        </>
      ) : null}
    </View>
  );
}
