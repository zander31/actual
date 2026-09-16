// Fork addition: 90-day cash curve = upstream schedules forecast, overlaid with rolling
// 3-month variable-spend rates (non-scheduled outflows) as best / expected / worst bands,
// plus projected month-end balances for the next 3 months.
//
// The page has one job: say whether the money runs out and when. The figure
// leads, the curve changes colour at zero, the crossing is marked, and
// everything else recedes to hairlines.
import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { ForecastDataPoint } from '@actual-app/core/types/models/forecast';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { aqlQuery } from '#queries/aqlQuery';

import {
  combineByDate,
  monthEnds,
  monthlyTotals,
  projectBands,
  RED_BELOW,
  variableSpendRates,
} from './forecastMath';
import type { SpendRates } from './forecastMath';
import {
  chip,
  columnLabel,
  DashSwatch,
  Delta,
  HeroNumber,
  LegendRow,
  Rule,
  sectionLabel,
  Swatch,
  wash,
} from './primitives';

const DAYS = 90;
const HISTORY_MONTHS = 3;

export function ForecastPage() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const format = useFormat();
  const { data: accounts = [] } = useAccounts();
  const onBudget = useMemo(
    () => accounts.filter(a => !a.closed && !a.offbudget),
    [accounts],
  );

  const [accountId, setAccountId] = useState<string>('');
  const [points, setPoints] = useState<ForecastDataPoint[]>([]);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!accountId && onBudget.length) {
      setAccountId(onBudget.find(a => /check/i.test(a.name))?.id ?? 'all');
    }
  }, [accountId, onBudget]);

  useEffect(() => {
    if (!accountId) return;
    const ids = accountId === 'all' ? onBudget.map(a => a.id) : [accountId];
    const today = monthUtils.currentDay();
    const thisMonthStart = monthUtils.firstDayOfMonth(today);
    const historyStart = monthUtils.firstDayOfMonth(
      monthUtils.subMonths(today, HISTORY_MONTHS),
    );
    let cancelled = false;

    void send('forecast/generate', {
      accountIds: ids,
      startDate: today,
      endDate: monthUtils.addDays(today, DAYS),
    }).then(res => {
      if (!cancelled) setPoints(res.dataPoints);
    });

    // variable spend = outflows not produced by a schedule, last 3 complete months, same accounts
    void aqlQuery(
      q('transactions')
        .filter({
          $and: [
            { date: { $gte: historyStart } },
            { date: { $lt: thisMonthStart } },
          ],
          amount: { $lt: 0 },
          schedule: null,
          transfer_id: null,
          is_parent: false,
          account: { $oneof: ids },
        })
        .select(['date', 'amount']),
    ).then(({ data }) => {
      if (!cancelled) {
        setHistory(monthlyTotals(data as { date: string; amount: number }[]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, onBudget]);

  const rates: SpendRates = useMemo(
    () => variableSpendRates(history),
    [history],
  );
  const bands = useMemo(
    () => projectBands(combineByDate(points), rates),
    [points, rates],
  );
  const ends = useMemo(() => monthEnds(bands), [bands]);
  const chartData = bands.map(b => ({
    ...b,
    band: [b.worst, b.best] as [number, number],
  }));

  // the answer the page exists to give
  const crossing = bands.find(b => b.expected < 0) ?? null;
  const lowest = bands.reduce<(typeof bands)[number] | null>(
    (m, b) => (!m || b.expected < m.expected ? b : m),
    null,
  );
  // where zero sits in the plotted range, so the curve can change colour there
  // instead of the chart shading a whole region red
  const yMax = Math.max(0, ...bands.map(b => b.best));
  const yMin = Math.min(0, ...bands.map(b => b.worst));
  const zeroOffset = yMax === yMin ? 1 : yMax / (yMax - yMin);
  // widened so recharts infers a numeric Y domain rather than the literal 0
  const zeroLine: number = 0;
  const last = bands.length ? bands[bands.length - 1] : null;
  const lastDate = last?.date ?? null;
  const endColor =
    last && last.expected < 0 ? theme.errorBorder : theme.reportsChartFill;
  const longDate = (d: string) => monthUtils.format(d, 'EEEE, d MMMM');

  return (
    <Page header={isNarrowWidth ? t('Forecast') : null}>
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 22,
          flexShrink: 0,
        }}
      >
        <Select
          value={accountId}
          onChange={v => setAccountId(v)}
          options={[
            ['all', t('All on-budget accounts')],
            ...onBudget.map(a => [a.id, a.name] as [string, string]),
          ]}
        />
      </View>

      {lowest && (
        <View style={{ marginBottom: 30, gap: 8, flexShrink: 0 }}>
          <HeroNumber
            color={lowest.expected < 0 ? theme.errorText : theme.pageText}
          >
            {format(lowest.expected, 'financial')}
          </HeroNumber>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Delta
              up={lowest.expected >= 0}
              amount={
                crossing ? t('Projected low') : t('Thinnest day in 90 days')
              }
              period={longDate(lowest.date)}
            />
            {crossing && (
              <Text
                style={{
                  ...chip,
                  backgroundColor: wash(
                    theme.errorText,
                    12,
                    theme.pageBackground,
                  ),
                  color: theme.errorText,
                }}
              >
                <Trans>
                  Runs out {{ when: monthUtils.format(crossing.date, 'd MMM') }}
                </Trans>
              </Text>
            )}
          </View>
        </View>
      )}

      {last && (
        <View style={{ gap: 7, marginBottom: 14, flexShrink: 0 }}>
          <LegendRow
            swatch={<Swatch color={theme.reportsChartFill} />}
            value={t('{{worst}} to {{best}}', {
              worst: format(last.worst, 'financial-no-decimals'),
              best: format(last.best, 'financial-no-decimals'),
            })}
            label={t('Range in 90 days')}
          />
          <LegendRow
            swatch={<DashSwatch color={theme.pageTextSubdued} />}
            value={format(last.schedules, 'financial-no-decimals')}
            label={t('Schedules alone')}
          />
        </View>
      )}

      <svg
        width="0"
        height="0"
        aria-hidden="true"
        style={{ position: 'absolute' }}
      >
        <defs>
          {/* one hard stop exactly at zero: above it the curve is a gain,
              below it it is money you do not have */}
          <linearGradient id="fc-curve" x1="0" y1="0" x2="0" y2="1">
            <stop offset={zeroOffset} stopColor={theme.reportsChartFill} />
            <stop offset={zeroOffset} stopColor={theme.errorBorder} />
          </linearGradient>
          <linearGradient id="fc-band" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset={zeroOffset}
              stopColor={theme.reportsChartFill}
              stopOpacity={0.16}
            />
            <stop
              offset={zeroOffset}
              stopColor={theme.errorBorder}
              stopOpacity={0.12}
            />
          </linearGradient>
        </defs>
      </svg>

      <View
        style={{
          height: 300,
          // a flex column will happily shrink this below the SVG it contains,
          // which spills the axes onto whatever follows
          flexShrink: 0,
          backgroundColor: theme.surfaceSunken,
          borderRadius: 16,
          padding: '10px 8px 0 0',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 6, right: 16, bottom: 0, left: 4 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={theme.pageTextSubdued}
              strokeOpacity={0.35}
              strokeDasharray="1 5"
            />
            <XAxis
              dataKey="date"
              tick={{ fill: theme.pageTextSubdued, fontSize: 11 }}
              tickFormatter={d => monthUtils.format(d, 'd MMM')}
              tickLine={false}
              axisLine={{ stroke: theme.tableBorder }}
              minTickGap={34}
            />
            <YAxis
              tick={{ fill: theme.pageTextSubdued, fontSize: 11 }}
              tickFormatter={v => format(v, 'financial-no-decimals')}
              tickLine={false}
              axisLine={false}
              width={74}
            />
            <Tooltip
              cursor={{ stroke: theme.pageTextSubdued, strokeWidth: 1 }}
              labelFormatter={d => longDate(String(d))}
              formatter={(value, name) =>
                Array.isArray(value)
                  ? [
                      `${format(Number(value[0]), 'financial')} – ${format(Number(value[1]), 'financial')}`,
                      t('worst – best'),
                    ]
                  : [format(Number(value), 'financial'), String(name)]
              }
              contentStyle={{
                backgroundColor: theme.tooltipBackground,
                color: theme.tooltipText,
                border: `1px solid ${theme.tooltipBorder}`,
                borderRadius: 6,
                boxShadow: '0 6px 16px rgba(0,0,0,0.14)',
                ...styles.tnum,
              }}
            />
            <ReferenceLine
              y={0}
              stroke={theme.pageText}
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
            <ReferenceLine
              y={RED_BELOW}
              stroke={theme.errorText}
              strokeDasharray="3 4"
              strokeOpacity={0.5}
              label={{
                value: t('$500'),
                position: 'insideTopRight',
                fill: theme.errorText,
                fontSize: 10,
              }}
            />
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill="url(#fc-band)"
              fillOpacity={1}
              name={t('band')}
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="schedules"
              stroke={theme.pageTextLight}
              dot={false}
              strokeDasharray="1 5"
              strokeLinecap="round"
              strokeWidth={2}
              name={t('schedules only')}
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="url(#fc-curve)"
              dot={false}
              strokeWidth={2.5}
              strokeLinecap="round"
              name={t('expected')}
              animationDuration={900}
              animationEasing="ease-out"
            />
            {crossing && (
              <ReferenceDot
                x={crossing.date}
                y={zeroLine}
                r={12}
                fill={theme.errorBorder}
                fillOpacity={0.18}
                stroke="none"
              />
            )}
            {crossing && (
              <ReferenceDot
                x={crossing.date}
                y={zeroLine}
                r={5}
                fill={theme.errorBorder}
                stroke={theme.surfaceSunken}
                strokeWidth={2}
              />
            )}
            {last && (
              <ReferenceDot
                x={last.date}
                y={last.expected}
                r={12}
                fill={endColor}
                fillOpacity={0.18}
                stroke="none"
              />
            )}
            {last && (
              <ReferenceDot
                x={last.date}
                y={last.expected}
                r={5}
                fill={endColor}
                stroke={theme.surfaceSunken}
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </View>

      <View style={{ marginTop: 34, maxWidth: 580, flexShrink: 0 }}>
        <Text style={{ ...styles.displayText, marginBottom: 14 }}>
          <Trans>Where each month lands</Trans>
        </Text>
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr 1fr 1fr',
            rowGap: 0,
            columnGap: 16,
            flexShrink: 0,
          }}
        >
          {[t('Month'), t('Worst'), t('Expected'), t('Best')].map((h, i) => (
            <Text
              key={h}
              style={{
                ...columnLabel,
                textAlign: i === 0 ? 'left' : 'right',
                paddingBottom: 7,
              }}
            >
              {h}
            </Text>
          ))}
          <Rule style={{ gridColumn: '1 / -1' }} />
          {ends.map(e => {
            const cell = {
              ...styles.tnum,
              textAlign: 'right' as const,
              padding: '9px 0',
            };
            return (
              <View key={e.date} style={{ display: 'contents' }}>
                <Text style={{ padding: '9px 0', color: theme.pageText }}>
                  {monthUtils.format(e.date.slice(0, 7), 'MMMM yyyy')}
                </Text>
                <Text
                  style={{
                    ...cell,
                    color:
                      e.worst < 0 ? theme.errorText : theme.pageTextSubdued,
                  }}
                >
                  {format(e.worst, 'financial-no-decimals')}
                </Text>
                <Text
                  style={{
                    ...cell,
                    fontWeight: 600,
                    color: e.expected < 0 ? theme.errorText : theme.pageText,
                  }}
                >
                  {format(e.expected, 'financial-no-decimals')}
                </Text>
                <Text style={{ ...cell, color: theme.pageTextSubdued }}>
                  {format(e.best, 'financial-no-decimals')}
                </Text>
                <Rule style={{ gridColumn: '1 / -1' }} />
              </View>
            );
          })}
        </View>

        <View
          style={{
            marginTop: 20,
            padding: '14px 16px',
            borderRadius: 14,
            backgroundColor: theme.surfaceSunken,
            gap: 5,
          }}
        >
          <Text style={{ ...sectionLabel }}>
            <Trans>How this is worked out</Trans>
          </Text>
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.55 }}>
            <Trans>
              The dashed line is your schedules alone, from the same engine as
              the Balance Forecast report. The band subtracts your best, average
              and worst month of non-scheduled spending over the last{' '}
              {{ n: history.length }} months, spread evenly per day — currently{' '}
              {{
                best: format(Math.round(rates.best), 'financial-no-decimals'),
              }}
              ,{' '}
              {{
                expected: format(
                  Math.round(rates.expected),
                  'financial-no-decimals',
                ),
              }}{' '}
              and{' '}
              {{
                worst: format(Math.round(rates.worst), 'financial-no-decimals'),
              }}{' '}
              a day.
            </Trans>
          </Text>
          {lastDate && (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              <Trans>
                Projected through {{ through: longDate(lastDate) }}.
              </Trans>
            </Text>
          )}
        </View>
      </View>
    </Page>
  );
}
