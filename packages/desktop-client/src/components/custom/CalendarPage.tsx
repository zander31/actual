// Fork addition: month calendar of projected end-of-day balances (current balance + schedules),
// bills due per day, and click-a-day "what-if" spend that re-projects live.
//
// The balance is a continuous quantity, so each day carries a bar scaled to the
// month's own range — the shape of the month is readable at a glance, and the
// threshold colours mark where it matters instead of tiling the whole grid.
import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgArrowThinLeft,
  SvgArrowThinRight,
} from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { ForecastDataPoint } from '@actual-app/core/types/models/forecast';

import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';

import { applyWhatIf, combineByDate } from './forecastMath';
import type { DayPoint } from './forecastMath';
import {
  balanceFill,
  balanceInk,
  columnLabel,
  Delta,
  HeroNumber,
  RoundButton,
  Rule,
  sectionLabel,
  wash,
} from './primitives';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Definite track height: a percentage inside a flex-sized box never resolves. */
const TRACK_HEIGHT = 62;

export function CalendarPage() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
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

  // Bars are scaled across the month's own range rather than from zero. The
  // question this page answers is "how low does it get", and a zero baseline
  // flattens a month that swings between $400 and $1,100 into near-identical
  // bars. The floor keeps the lowest day visible instead of collapsing it.
  const balances = days.map(d => d.balance);
  const lo = balances.length ? Math.min(...balances) : 0;
  const hi = balances.length ? Math.max(...balances) : 1;
  const span = hi - lo;
  const fill = (balance: number) =>
    span < 1
      ? 1
      : 0.12 + 0.88 * Math.max(0, Math.min(1, (balance - lo) / span));

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
    <Page header={isNarrowWidth ? t('Calendar') : null}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 24,
          flexShrink: 0,
        }}
      >
        <RoundButton
          onPress={() => setMonth(monthUtils.prevMonth(month))}
          label={t('Previous month')}
        >
          <SvgArrowThinLeft width={14} height={14} />
        </RoundButton>
        <Text
          style={{
            ...styles.displayText,
            fontSize: 21,
            minWidth: 176,
            textAlign: 'center',
          }}
        >
          {monthUtils.format(month, 'MMMM yyyy')}
        </Text>
        <RoundButton
          onPress={() => setMonth(monthUtils.nextMonth(month))}
          label={t('Next month')}
        >
          <SvgArrowThinRight width={14} height={14} />
        </RoundButton>
        <Button
          variant="bare"
          style={{ marginLeft: 6 }}
          onPress={() => setMonth(monthUtils.currentMonth())}
        >
          <Trans>Today</Trans>
        </Button>
        <View style={{ width: 12 }} />
        <Select
          value={accountId}
          onChange={v => setAccountId(v)}
          options={[
            ['all', t('All on-budget accounts')],
            ...onBudget.map(a => [a.id, a.name] as [string, string]),
          ]}
        />
        <View style={{ flex: 1 }} />
        {Object.keys(whatIf).length > 0 && (
          <Button variant="bare" onPress={() => setWhatIf({})}>
            <Trans>Clear what-ifs</Trans>
          </Button>
        )}
      </View>

      {lowest && (
        <View style={{ marginBottom: 34, gap: 8, flexShrink: 0 }}>
          <HeroNumber color={balanceInk(lowest.balance)}>
            {format(lowest.balance, 'financial')}
          </HeroNumber>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Delta
              up={false}
              amount={t('Lowest balance')}
              period={monthUtils.format(lowest.date, 'EEEE, d MMMM')}
            />
          </View>
        </View>
      )}

      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          columnGap: 6,
        }}
      >
        {WEEKDAYS.map(d => (
          <Text
            key={d}
            style={{ ...columnLabel, textAlign: 'center', paddingBottom: 9 }}
          >
            {d}
          </Text>
        ))}
        <Rule style={{ gridColumn: '1 / -1', marginBottom: 6 }} />
      </View>

      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          columnGap: 8,
          rowGap: 14,
          flexShrink: 0,
        }}
      >
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} />;
          const d = byDate.get(date);
          const ink = d ? balanceInk(d.balance) : theme.pageTextSubdued;
          const bar = d ? balanceFill(d.balance) : theme.tableBorder;
          const due = (d?.transactions ?? []).reduce(
            (sum, b) => sum + b.amount,
            0,
          );
          const isSelected = selectedDay === date;
          const isToday = date === today;
          const isPast = date < today;

          return (
            <View
              key={date}
              role="button"
              tabIndex={0}
              aria-label={t('{{date}} — projected balance {{amount}}', {
                date,
                amount: d ? format(d.balance, 'financial') : '—',
              })}
              onClick={() => {
                setSelectedDay(date);
                setDraft(whatIf[date] ? String(whatIf[date] / 100) : '');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedDay(date);
              }}
              style={{
                height: 132,
                padding: '9px 9px 0',
                borderRadius: '10px 10px 0 0',
                cursor: 'pointer',
                justifyContent: 'flex-start',
                // no resting box: the bar is the cell. A wash marks selection.
                backgroundColor: isSelected
                  ? wash(bar, 9, theme.tableBackground)
                  : 'transparent',
                borderBottom: `1px solid ${
                  isSelected ? bar : theme.tableBorder
                }`,
                opacity: isPast ? 0.55 : 1,
                transition: 'background-color .14s ease, opacity .14s ease',
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                },
                ':hover': {
                  backgroundColor: isSelected
                    ? wash(bar, 9, theme.tableBackground)
                    : theme.tableRowBackgroundHover,
                  opacity: 1,
                },
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? 650 : 500,
                  color: isToday
                    ? theme.tableBackground
                    : theme.pageTextSubdued,
                  // today reads as a struck date, not a heavier border
                  backgroundColor: isToday ? theme.pageText : 'transparent',
                  borderRadius: 999,
                  minWidth: 20,
                  height: 20,
                  lineHeight: '20px',
                  textAlign: 'center',
                  alignSelf: 'flex-start',
                  marginLeft: isToday ? -3 : 0,
                  flexShrink: 0,
                }}
              >
                {Number(date.slice(8))}
              </Text>

              <Text
                style={{
                  ...styles.displayFace,
                  fontSize: 19,
                  color: ink,
                  marginTop: 3,
                  flexShrink: 0,
                }}
              >
                {d ? format(d.balance, 'financial-no-decimals') : '—'}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  gap: 5,
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {due !== 0 && (
                  <Text
                    style={{
                      ...styles.tnum,
                      fontSize: 11,
                      fontWeight: 500,
                      color: theme.pageTextSubdued,
                    }}
                  >
                    {format(due, 'financial-no-decimals')}
                  </Text>
                )}
                {whatIf[date] ? (
                  <Text
                    style={{
                      ...styles.tnum,
                      fontSize: 11,
                      fontWeight: 600,
                      color: theme.pageTextLink,
                    }}
                  >
                    −{format(whatIf[date], 'financial-no-decimals')}
                  </Text>
                ) : null}
              </View>

              {/* the day standing on the row's baseline, scaled to the month */}
              <View
                style={{
                  height: TRACK_HEIGHT,
                  flexShrink: 0,
                  justifyContent: 'flex-end',
                  marginTop: 'auto',
                  borderRadius: '6px 6px 0 0',
                  backgroundColor: theme.surfaceSunken,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    // full height, scaled from the baseline: animating height
                    // is a layout property, and scaleY composites instead
                    height: TRACK_HEIGHT,
                    transformOrigin: 'bottom center',
                    transform: `scaleY(${d ? fill(d.balance) : 0})`,
                    borderRadius: '6px 6px 0 0',
                    // lit along the top edge, deepening toward the baseline,
                    // with one darker face down the right side
                    background: `linear-gradient(177deg, ${wash(
                      bar,
                      88,
                      '#ffffff',
                    )} 0%, ${bar} 26%, ${wash(bar, 72, theme.surfaceSunken)} 100%)`,
                    boxShadow: `inset -1.5px 0 0 0 ${wash(bar, 80, '#000000')}`,
                    transition: 'transform .34s cubic-bezier(0.22,1,0.36,1)',
                    '@media (prefers-reduced-motion: reduce)': {
                      transition: 'none',
                    },
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>

      {selectedDay && (
        <View
          style={{
            marginTop: 18,
            padding: '16px 18px',
            borderRadius: 14,
            backgroundColor: theme.surfaceSunken,
            gap: 10,
            maxWidth: 560,
          }}
        >
          <Text style={{ ...styles.displayText, fontSize: 17 }}>
            {t('What if you spent on {{date}}?', {
              date: monthUtils.format(selectedDay, 'EEEE, d MMMM'),
            })}
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
          {(byDate.get(selectedDay)?.transactions.length ?? 0) > 0 && (
            <>
              <Rule />
              <Text style={{ ...sectionLabel }}>
                <Trans>Due this day</Trans>
              </Text>
              <View style={{ gap: 3 }}>
                {byDate.get(selectedDay)?.transactions.map((b, j) => (
                  <View
                    key={j}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: theme.pageTextLight }}>
                      {b.scheduleName || b.payee}
                    </Text>
                    <Text
                      style={{
                        color: theme.pageText,
                        ...styles.tnum,
                      }}
                    >
                      {format(b.amount, 'financial')}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </Page>
  );
}
