// Fork addition: month calendar of projected end-of-day balances (current balance + schedules),
// bills due per day, green/yellow/red, and click-a-day "what-if" spend that re-projects live.
import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { ForecastDataPoint } from '@actual-app/core/types/models/forecast';

import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';

import { applyWhatIf, combineByDate, dayColor } from './forecastMath';
import type { DayPoint } from './forecastMath';

const COLORS = {
  green: { background: theme.noticeBackground, color: theme.noticeText },
  yellow: { background: theme.warningBackground, color: theme.warningText },
  red: { background: theme.errorBackground, color: theme.errorText },
} as const;

export function CalendarPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { data: accounts = [] } = useAccounts();
  const onBudget = useMemo(
    () => accounts.filter(a => !a.closed && !a.offbudget),
    [accounts],
  );

  const [month, setMonth] = useState(monthUtils.currentMonth());
  const [accountId, setAccountId] = useState<string>('');
  const [points, setPoints] = useState<ForecastDataPoint[]>([]);
  const [whatIf, setWhatIf] = useState<Record<string, number>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // default to the checking account, else all on-budget accounts
  useEffect(() => {
    if (!accountId && onBudget.length) {
      setAccountId(onBudget.find(a => /check/i.test(a.name))?.id ?? 'all');
    }
  }, [accountId, onBudget]);

  useEffect(() => {
    if (!accountId) return;
    const ids = accountId === 'all' ? onBudget.map(a => a.id) : [accountId];
    let cancelled = false;
    void send('forecast/generate', {
      accountIds: ids,
      startDate: monthUtils.firstDayOfMonth(month),
      endDate: monthUtils.lastDayOfMonth(month),
    }).then(res => {
      if (!cancelled) setPoints(res.dataPoints);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, month, onBudget]);

  const days: DayPoint[] = useMemo(
    () => applyWhatIf(combineByDate(points), whatIf),
    [points, whatIf],
  );
  const byDate = useMemo(() => new Map(days.map(d => [d.date, d])), [days]);

  // grid: leading blanks so the 1st lands on its weekday
  const first = monthUtils.firstDayOfMonth(month);
  const leading = new Date(first + 'T00:00:00').getDay();
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...monthUtils.dayRangeInclusive(first, monthUtils.lastDayOfMonth(month)),
  ];
  while (cells.length % 7) cells.push(null);

  const today = monthUtils.currentDay();
  const lowest = days.reduce<DayPoint | null>(
    (m, d) => (!m || d.balance < m.balance ? d : m),
    null,
  );

  function commitWhatIf() {
    if (!selectedDay) return;
    const dollars = parseFloat(draft.replace(/[^0-9.-]/g, ''));
    setWhatIf(w => {
      const next = { ...w };
      if (!dollars) delete next[selectedDay];
      else next[selectedDay] = Math.round(dollars * 100);
      return next;
    });
  }

  return (
    <Page header={t('Calendar')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <Button
          variant="bare"
          onPress={() => setMonth(monthUtils.prevMonth(month))}
          aria-label={t('Previous month')}
        >
          ‹
        </Button>
        <Text style={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
          {monthUtils.format(month, 'MMMM yyyy')}
        </Text>
        <Button
          variant="bare"
          onPress={() => setMonth(monthUtils.nextMonth(month))}
          aria-label={t('Next month')}
        >
          ›
        </Button>
        <Button
          variant="bare"
          onPress={() => setMonth(monthUtils.currentMonth())}
        >
          <Trans>Today</Trans>
        </Button>
        <Select
          value={accountId}
          onChange={v => setAccountId(v)}
          options={[
            ['all', t('All on-budget accounts')],
            ...onBudget.map(a => [a.id, a.name] as [string, string]),
          ]}
        />
        {lowest && (
          <Text style={{ color: theme.pageTextLight }}>
            {t('Low point: {{amount}} on {{date}}', {
              amount: format(lowest.balance, 'financial'),
              date: lowest.date,
            })}
          </Text>
        )}
        {Object.keys(whatIf).length > 0 && (
          <Button variant="bare" onPress={() => setWhatIf({})}>
            <Trans>Clear what-ifs</Trans>
          </Button>
        )}
      </View>

      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 4,
        }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <Text
            key={d}
            style={{
              textAlign: 'center',
              color: theme.pageTextLight,
              fontSize: 12,
            }}
          >
            {d}
          </Text>
        ))}
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} />;
          const d = byDate.get(date);
          const color = d
            ? COLORS[dayColor(d.balance)]
            : { background: theme.tableBackground, color: theme.pageText };
          const bills = d?.transactions ?? [];
          const isSelected = selectedDay === date;
          return (
            <View
              key={date}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedDay(date);
                setDraft(whatIf[date] ? String(whatIf[date] / 100) : '');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') setSelectedDay(date);
              }}
              style={{
                ...color,
                minHeight: 84,
                padding: 6,
                borderRadius: 6,
                cursor: 'pointer',
                border: `2px solid ${isSelected ? theme.pageTextLink : date === today ? theme.pageText : 'transparent'}`,
                opacity: date < today ? 0.7 : 1,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: 12 }}>{Number(date.slice(8))}</Text>
                {whatIf[date] && (
                  <Text style={{ fontSize: 11 }}>
                    −{format(whatIf[date], 'financial-no-decimals')}
                  </Text>
                )}
              </View>
              <Text style={{ fontWeight: 700, fontSize: 14 }}>
                {d ? format(d.balance, 'financial-no-decimals') : '—'}
              </Text>
              {bills.slice(0, 3).map((b, j) => (
                <Text
                  key={j}
                  style={{
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.scheduleName || b.payee || t('Schedule')}{' '}
                  {format(b.amount, 'financial-no-decimals')}
                </Text>
              ))}
              {bills.length > 3 && (
                <Text style={{ fontSize: 11 }}>+{bills.length - 3}</Text>
              )}
            </View>
          );
        })}
      </View>

      {selectedDay && (
        <View
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 6,
            backgroundColor: theme.tableBackground,
            border: `1px solid ${theme.tableBorder}`,
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: 600 }}>
            {t('What if I spend this on {{date}}?', { date: selectedDay })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Input
              value={draft}
              placeholder="0.00"
              onChangeValue={setDraft}
              onEnter={commitWhatIf}
              onBlur={commitWhatIf}
              style={{ width: 120 }}
            />
            <Button variant="primary" onPress={commitWhatIf}>
              <Trans>Apply</Trans>
            </Button>
            <Button variant="bare" onPress={() => setSelectedDay(null)}>
              <Trans>Close</Trans>
            </Button>
          </View>
          {byDate.get(selectedDay)?.transactions.map((b, j) => (
            <Text key={j} style={{ color: theme.pageTextLight }}>
              {b.scheduleName || b.payee} {format(b.amount, 'financial')}
            </Text>
          ))}
        </View>
      )}
    </Page>
  );
}
