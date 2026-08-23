// Fork addition: 90-day cash curve = upstream schedules forecast, overlaid with rolling
// 3-month variable-spend rates (non-scheduled outflows) as best / expected / worst bands,
// plus projected month-end balances for the next 3 months.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { ForecastDataPoint } from '@actual-app/core/types/models/forecast';
import {
  Area,
  ComposedChart,
  Line,
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
  variableSpendRates,
} from './forecastMath';
import type { SpendRates } from './forecastMath';

const DAYS = 90;
const HISTORY_MONTHS = 3;

export function ForecastPage() {
  const { t } = useTranslation();
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
  const lowest = bands.reduce<(typeof bands)[number] | null>(
    (m, b) => (!m || b.expected < m.expected ? b : m),
    null,
  );

  return (
    <Page header={t('Forecast')}>
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 10,
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
        <Text style={{ color: theme.pageTextLight }}>
          {t(
            'Variable spend (non-scheduled, last {{n}} months): best {{best}}/day · expected {{expected}}/day · worst {{worst}}/day',
            {
              n: history.length,
              best: format(Math.round(rates.best), 'financial-no-decimals'),
              expected: format(
                Math.round(rates.expected),
                'financial-no-decimals',
              ),
              worst: format(Math.round(rates.worst), 'financial-no-decimals'),
            },
          )}
        </Text>
        {lowest && (
          <Text
            style={{
              color:
                lowest.expected < 0 ? theme.errorText : theme.pageTextLight,
            }}
          >
            {t('Expected low: {{amount}} on {{date}}', {
              amount: format(lowest.expected, 'financial'),
              date: lowest.date,
            })}
          </Text>
        )}
      </View>

      <View
        style={{
          height: 320,
          backgroundColor: theme.tableBackground,
          borderRadius: 6,
          padding: 8,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 0, left: 10 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fill: theme.pageText, fontSize: 11 }}
              tickFormatter={d => d.slice(5)}
              minTickGap={30}
            />
            <YAxis
              tick={{ fill: theme.pageText, fontSize: 11 }}
              tickFormatter={v => format(v, 'financial-no-decimals')}
              width={80}
            />
            <Tooltip
              formatter={(value, name) =>
                Array.isArray(value)
                  ? [
                      `${format(Number(value[0]), 'financial')} – ${format(Number(value[1]), 'financial')}`,
                      t('worst – best'),
                    ]
                  : [format(Number(value), 'financial'), String(name)]
              }
              contentStyle={{
                backgroundColor: theme.menuBackground,
                color: theme.menuItemText,
                border: 'none',
              }}
            />
            <ReferenceLine y={0} stroke={theme.pageTextSubdued} />
            <ReferenceLine
              y={50_000}
              stroke={theme.errorText}
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill={theme.reportsBlue}
              fillOpacity={0.15}
              name={t('band')}
            />
            <Line
              type="monotone"
              dataKey="schedules"
              stroke={theme.pageTextSubdued}
              dot={false}
              strokeDasharray="3 3"
              name={t('schedules only')}
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke={theme.reportsBlue}
              dot={false}
              strokeWidth={2}
              name={t('expected')}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </View>

      <View style={{ marginTop: 16, maxWidth: 520 }}>
        <Text style={{ fontWeight: 600, marginBottom: 6 }}>
          {t('Projected month-end balance')}
        </Text>
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 6,
          }}
        >
          {[t('Month'), t('Worst'), t('Expected'), t('Best')].map(h => (
            <Text key={h} style={{ color: theme.pageTextLight, fontSize: 12 }}>
              {h}
            </Text>
          ))}
          {ends.map(e => (
            <View key={e.date} style={{ display: 'contents' }}>
              <Text>{monthUtils.format(e.date.slice(0, 7), 'MMM yyyy')}</Text>
              <Text
                style={{
                  color: e.worst < 0 ? theme.errorText : theme.pageText,
                }}
              >
                {format(e.worst, 'financial-no-decimals')}
              </Text>
              <Text
                style={{
                  fontWeight: 600,
                  color: e.expected < 0 ? theme.errorText : theme.pageText,
                }}
              >
                {format(e.expected, 'financial-no-decimals')}
              </Text>
              <Text>{format(e.best, 'financial-no-decimals')}</Text>
            </View>
          ))}
        </View>
        <Text
          style={{ color: theme.pageTextLight, fontSize: 12, marginTop: 8 }}
        >
          {t(
            'Schedules drive the dashed line (same engine as the Balance Forecast report). Bands subtract your best/average/worst month of non-scheduled spending, spread per day.',
          )}
        </Text>
      </View>
    </Page>
  );
}
