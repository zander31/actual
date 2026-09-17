// Fork addition: month calendar of projected end-of-day balances (current balance + schedules),
// bills due per day, and what-if spends that re-project live — a slider for
// today, and click-a-day for any other date.
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
import { css, keyframes } from '@emotion/css';

import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';

import {
  applyWhatIf,
  combineByDate,
  forecastWindow,
  hasScheduledIncome,
  RED_BELOW,
  YELLOW_BELOW,
} from './forecastMath';
import type { DayPoint } from './forecastMath';
import {
  balanceFill,
  balanceInk,
  columnLabel,
  Direction,
  HeroNumber,
  instrumentPage,
  NoticeBar,
  RoundButton,
  Rule,
  sectionLabel,
  wash,
} from './primitives';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Definite track height: a percentage inside a flex-sized box never resolves. */
const TRACK_HEIGHT = 66;

/** The slider's reach, in dollars — the mock's range for an unplanned spend. */
const SIMULATE_MAX = 600;
const SIMULATE_STEP = 10;

const rise = keyframes({
  from: { transform: 'scaleY(0)' },
});

type Format = ReturnType<typeof useFormat>;

export function CalendarPage() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const format = useFormat();
  const navigate = useNavigate();
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
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // default to the checking account, else all on-budget accounts
  useEffect(() => {
    if (!accountId && onBudget.length) {
      setAccountId(onBudget.find(a => /check/i.test(a.name))?.id ?? 'all');
    }
  }, [accountId, onBudget]);

  const today = monthUtils.currentDay();
  // The window has to reach back to today even when the month is ahead of us,
  // or the projection opens that month at today's balance and loses every
  // schedule in between — see forecastWindow.
  const window = useMemo(() => forecastWindow(month, today), [month, today]);

  useEffect(() => {
    if (!accountId) return;
    const ids = accountId === 'all' ? onBudget.map(a => a.id) : [accountId];
    let cancelled = false;
    void send('forecast/generate', {
      accountIds: ids,
      startDate: window.startDate,
      endDate: window.endDate,
    }).then(res => {
      if (!cancelled) setPoints(res.dataPoints);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, window, onBudget]);

  const first = monthUtils.firstDayOfMonth(month);
  const last = monthUtils.lastDayOfMonth(month);

  // A what-if set before this month (today's spend, viewed from next month)
  // still lowers every day of it, so it lands on the 1st.
  const monthWhatIf = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [date, cents] of Object.entries(whatIf)) {
      const key = date < first ? first : date;
      out[key] = (out[key] ?? 0) + cents;
    }
    return out;
  }, [whatIf, first]);

  const combined = useMemo(() => combineByDate(points), [points]);
  const days: DayPoint[] = useMemo(
    () =>
      applyWhatIf(
        combined.filter(d => d.date >= first),
        monthWhatIf,
      ),
    [combined, first, monthWhatIf],
  );
  // Nothing ahead is knowable without income schedules: the whole projection
  // is only the bills, so it can only ever fall.
  const noIncomeSchedule = useMemo(
    () => points.length > 0 && !hasScheduledIncome(combined),
    [points.length, combined],
  );
  const byDate = useMemo(() => new Map(days.map(d => [d.date, d])), [days]);

  // grid: leading blanks so the 1st lands on its weekday
  const leading = new Date(first + 'T00:00:00').getDay();
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...monthUtils.dayRangeInclusive(first, last),
  ];
  while (cells.length % 7) cells.push(null);

  const lowestOf = (list: DayPoint[]) =>
    list.reduce<DayPoint | null>(
      (m, d) => (!m || d.balance < m.balance ? d : m),
      null,
    );
  const monthLow = lowestOf(days);
  const ahead = days.filter(d => d.date >= today);
  // a month already behind us has nothing left: its low is the answer
  const thinnest = lowestOf(ahead) ?? monthLow;
  const monthIsPast = last < today;

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

  const monthName = monthUtils.format(month, 'MMMM');
  const todaySpend = whatIf[today] ?? 0;

  function selectDay(date: string) {
    setSelectedDay(date);
    setDraft(whatIf[date] ? String(whatIf[date] / 100) : '');
  }

  function setSpend(date: string, cents: number) {
    setWhatIf(w => {
      const next = { ...w };
      if (!cents) delete next[date];
      else next[date] = cents;
      return next;
    });
  }

  function commitWhatIf() {
    if (!selectedDay) return;
    const dollars = parseFloat(draft.replace(/[^0-9.-]/g, ''));
    setSpend(selectedDay, dollars ? Math.round(dollars * 100) : 0);
  }

  const heroLabel = monthIsPast
    ? t('Thinnest day in {{month}}', { month: monthName })
    : todaySpend && today >= first
      ? t('Thinnest day left, after spending {{amount}} today', {
          amount: format(todaySpend, 'financial-no-decimals'),
        })
      : today < first
        ? t('Thinnest day in {{month}}', { month: monthName })
        : t('Thinnest day left in {{month}}', { month: monthName });

  const heroInk = thinnest ? balanceInk(thinnest.balance) : theme.pageText;

  const simulateNote = monthIsPast
    ? t('{{month}} is behind us — nothing left to simulate.', {
        month: monthName,
      })
    : todaySpend && thinnest
      ? t(
          'Spending {{amount}} today takes the thinnest day ahead down to {{low}} on the {{day}}.',
          {
            amount: format(todaySpend, 'financial-no-decimals'),
            low: format(thinnest.balance, 'financial-no-decimals'),
            day: monthUtils.format(thinnest.date, 'do'),
          },
        )
      : t(
          'Drag to see what an unplanned spend today does to the rest of the month.',
        );

  const simulate = (
    <View
      style={{
        width: 400,
        maxWidth: '100%',
        flexShrink: 0,
        backgroundColor: theme.cardBackground,
        borderRadius: 16,
        boxShadow: `inset 0 0 0 1px ${theme.cardBorder}`,
        padding: '20px 22px 22px',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.014em',
            color: theme.pageText,
            whiteSpace: 'nowrap',
          }}
        >
          <Trans>Simulate spending today</Trans>
        </Text>
        <Text
          style={{
            ...styles.displayText,
            color: theme.pageText,
            whiteSpace: 'nowrap',
          }}
        >
          {format(todaySpend, 'financial-no-decimals')}
        </Text>
      </View>
      <input
        type="range"
        min={0}
        max={SIMULATE_MAX}
        step={SIMULATE_STEP}
        disabled={monthIsPast}
        aria-label={t('Simulated spend today')}
        value={Math.min(SIMULATE_MAX, todaySpend / 100)}
        onChange={e => setSpend(today, Number(e.target.value) * 100)}
        className={css({
          width: '100%',
          margin: '16px 0 6px',
          accentColor: theme.pageText,
          cursor: 'pointer',
          ':disabled': { cursor: 'default', opacity: 0.5 },
          ':focus-visible': {
            outline: `2px solid ${theme.pageText}`,
            outlineOffset: 3,
            borderRadius: 4,
          },
        })}
      />
      <Text
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: theme.pageTextLight,
          lineHeight: 1.45,
        }}
      >
        {simulateNote}
      </Text>
    </View>
  );

  return (
    <Page header={isNarrowWidth ? t('Calendar') : null} padding={0}>
      <View
        style={{
          ...instrumentPage,
          ...(isNarrowWidth && { padding: '16px 16px 40px' }),
        }}
      >
        {/* hero: the thinnest day ahead, opposite the simulator */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <View style={{ gap: 6, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '-0.008em',
                color: theme.pageTextSubdued,
              }}
            >
              {heroLabel}
            </Text>
            <HeroNumber color={heroInk}>
              {thinnest ? format(thinnest.balance, 'financial') : '—'}
            </HeroNumber>
            {thinnest && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <Direction up={false} color={heroInk} />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.012em',
                    whiteSpace: 'nowrap',
                    color: heroInk,
                  }}
                >
                  {monthUtils.format(thinnest.date, "EEEE 'the' do")}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    letterSpacing: '-0.012em',
                    color: theme.pageTextLight,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {relativeDay(thinnest.date, today, t)}
                </Text>
                {monthLow && monthLow.date !== thinnest.date && (
                  <Text
                    style={{
                      ...styles.tnum,
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 26,
                      padding: '0 11px',
                      marginLeft: 4,
                      borderRadius: 999,
                      backgroundColor: theme.surfaceSunken,
                      color: theme.pageTextSubdued,
                      fontSize: 12,
                      fontWeight: 650,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {monthLow.date < today
                      ? t("Month's low was {{amount}} on the {{day}}", {
                          amount: format(
                            monthLow.balance,
                            'financial-no-decimals',
                          ),
                          day: monthUtils.format(monthLow.date, 'do'),
                        })
                      : t("Month's low is {{amount}} on the {{day}}", {
                          amount: format(
                            monthLow.balance,
                            'financial-no-decimals',
                          ),
                          day: monthUtils.format(monthLow.date, 'do'),
                        })}
                  </Text>
                )}
              </View>
            )}
          </View>
          {simulate}
        </View>

        {noIncomeSchedule && (
          <NoticeBar
            title={
              <Trans>
                No income is scheduled in this window, so the projection is
                bills only
              </Trans>
            }
            detail={
              <Trans>
                Every day below can only fall. Add your pay as a schedule and
                this grid becomes the real end-of-day balance.
              </Trans>
            }
            action={
              <Button
                variant="primary"
                onPress={() => navigate('/schedules')}
                style={{ height: 32, padding: '0 14px', fontSize: 13 }}
              >
                <Trans>Set up schedules</Trans>
              </Button>
            }
          />
        )}

        {/* month header: step, name, today, account — legend opposite */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 24,
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
              whiteSpace: 'nowrap',
              minWidth: 168,
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
          {Object.keys(whatIf).length > 0 && (
            <Button variant="bare" onPress={() => setWhatIf({})}>
              <Trans>Clear what-ifs</Trans>
            </Button>
          )}
          <View style={{ flex: 1 }} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <LegendKey
              color={balanceFill(YELLOW_BELOW)}
              label={t('above {{amount}}', {
                amount: format(YELLOW_BELOW, 'financial-no-decimals'),
              })}
            />
            <LegendKey
              color={balanceFill(RED_BELOW)}
              label={`${format(RED_BELOW, 'financial-no-decimals')}–${format(
                YELLOW_BELOW,
                'financial-no-decimals',
              )}`}
            />
            <LegendKey
              color={balanceFill(RED_BELOW - 1)}
              label={t('below {{amount}}', {
                amount: format(RED_BELOW, 'financial-no-decimals'),
              })}
            />
          </View>
        </View>

        <View
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            columnGap: 8,
            marginTop: 18,
            flexShrink: 0,
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
          <Rule style={{ gridColumn: '1 / -1', marginBottom: 8 }} />
        </View>

        <View
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            columnGap: 8,
            rowGap: 16,
            flexShrink: 0,
          }}
        >
          {cells.map((date, i) => {
            if (!date) return <View key={`blank-${i}`} />;
            const d = byDate.get(date);
            const ink = d ? balanceInk(d.balance) : theme.pageTextSubdued;
            const bar = d ? balanceFill(d.balance) : theme.tableBorder;
            const bills = d?.transactions ?? [];
            const due = bills
              .filter(b => b.amount < 0)
              .reduce((sum, b) => sum + b.amount, 0);
            const isSelected = selectedDay === date;
            const isHovered = hoverDay === date;
            const isToday = date === today;
            const isPast = date < today;
            const lit = isSelected || isHovered;

            return (
              <View
                key={date}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={t('{{date}} — projected balance {{amount}}', {
                  date: monthUtils.format(date, 'EEEE, d MMMM'),
                  amount: d ? format(d.balance, 'financial') : '—',
                })}
                onClick={() => selectDay(date)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectDay(date);
                  }
                }}
                onMouseEnter={() => setHoverDay(date)}
                onMouseLeave={() => setHoverDay(h => (h === date ? null : h))}
                onFocus={() => setHoverDay(date)}
                onBlur={() => setHoverDay(h => (h === date ? null : h))}
                style={{
                  position: 'relative',
                  zIndex: isHovered ? 5 : undefined,
                  height: 146,
                  padding: '10px 10px 0',
                  borderRadius: '10px 10px 0 0',
                  cursor: 'pointer',
                  justifyContent: 'flex-start',
                  backgroundColor: isSelected
                    ? wash(bar, 9, theme.pageBackground)
                    : isHovered
                      ? theme.tableRowBackgroundHover
                      : 'transparent',
                  borderBottom: `1px solid ${lit ? bar : theme.tableBorder}`,
                  opacity: isPast && !lit ? 0.5 : 1,
                  outline: 'none',
                  transition: 'background-color .14s ease, opacity .14s ease',
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                  },
                  ':focus-visible': {
                    boxShadow: `inset 0 0 0 2px ${theme.pageText}`,
                  },
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      ...styles.tnum,
                      fontSize: 12,
                      fontWeight: isToday ? 650 : 500,
                      color: isToday
                        ? theme.pageBackground
                        : theme.pageTextSubdued,
                      // today reads as a struck date, not a heavier border
                      backgroundColor: isToday ? theme.pageText : 'transparent',
                      borderRadius: 999,
                      minWidth: 20,
                      height: 20,
                      lineHeight: '20px',
                      textAlign: 'center',
                    }}
                  >
                    {Number(date.slice(8))}
                  </Text>
                  <View
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: bills.length
                        ? theme.tableBorderHover
                        : 'transparent',
                    }}
                  />
                </View>

                <Text
                  style={{
                    ...styles.displayFace,
                    fontSize: 20,
                    color: ink,
                    marginTop: 4,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
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
                    minHeight: 15,
                  }}
                >
                  {due !== 0 && (
                    <Text
                      style={{
                        ...styles.tnum,
                        fontSize: 11,
                        fontWeight: 500,
                        color: theme.pageTextSubdued,
                        whiteSpace: 'nowrap',
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
                        whiteSpace: 'nowrap',
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
                      // lit along the top edge, one darker face down the right
                      background: `linear-gradient(177deg, ${wash(
                        bar,
                        82,
                        theme.cardBackground,
                      )} 0%, ${bar} 26%, ${bar} 100%)`,
                      boxShadow: `inset -1.5px 0 0 0 ${wash(
                        theme.pageText,
                        16,
                        'transparent',
                      )}`,
                      transition: 'transform .34s cubic-bezier(0.22,1,0.36,1)',
                      animation: `${rise} .5s cubic-bezier(0.22,1,0.36,1)`,
                      '@media (prefers-reduced-motion: reduce)': {
                        transition: 'none',
                        animation: 'none',
                      },
                    }}
                  />
                </View>

                {isHovered && d && (
                  <DayTooltip
                    day={d}
                    column={i % 7}
                    spend={whatIf[date]}
                    format={format}
                  />
                )}
              </View>
            );
          })}
        </View>

        {selectedDay && (
          <View
            style={{
              marginTop: 24,
              padding: '20px 22px 22px',
              borderRadius: 16,
              backgroundColor: theme.cardBackground,
              boxShadow: `inset 0 0 0 1px ${theme.cardBorder}`,
              gap: 12,
              maxWidth: 560,
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.014em',
                color: theme.pageText,
              }}
            >
              {t('What if you spent on {{date}}?', {
                date: monthUtils.format(selectedDay, 'EEEE, d MMMM'),
              })}
            </Text>
            <View
              style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
            >
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
                        gap: 10,
                      }}
                    >
                      <Text style={{ color: theme.pageTextLight }}>
                        {b.scheduleName || b.payee}
                      </Text>
                      <Text style={{ color: theme.pageText, ...styles.tnum }}>
                        {format(b.amount, 'financial')}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </Page>
  );
}

/** "today", "tomorrow", "in 12 days", "3 days ago". */
function relativeDay(
  date: string,
  today: string,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const diff = Math.round(
    (new Date(date + 'T00:00:00').getTime() -
      new Date(today + 'T00:00:00').getTime()) /
      86_400_000,
  );
  if (diff === 0) return t('today');
  if (diff === 1) return t('tomorrow');
  if (diff > 1) return t('in {{count}} days', { count: diff });
  return t('{{count}} days ago', { count: -diff });
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 4,
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <Text
        style={{
          ...styles.tnum,
          fontSize: 13,
          fontWeight: 500,
          color: theme.pageTextLight,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** The hover card above a day: its date, balance, and what is due. */
function DayTooltip({
  day,
  column,
  spend,
  format,
}: {
  day: DayPoint;
  column: number;
  spend: number | undefined;
  format: Format;
}) {
  const { t } = useTranslation();
  // the outer columns anchor to their own edge so the card stays on the page
  const anchor =
    column === 0
      ? { left: 0, transform: 'translateY(-10px)' }
      : column === 6
        ? { right: 0, transform: 'translateY(-10px)' }
        : { left: '50%', transform: 'translate(-50%, -10px)' };

  return (
    <View
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: '100%',
        ...anchor,
        width: 216,
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        boxShadow: `0 10px 28px ${theme.cardShadow}, 0 0 0 1px ${theme.cardBorder}`,
        padding: '13px 15px',
        zIndex: 30,
        pointerEvents: 'none',
        cursor: 'default',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: theme.pageTextSubdued,
          whiteSpace: 'nowrap',
        }}
      >
        {monthUtils.format(day.date, 'EEEE, d MMMM')}
      </Text>
      <Text
        style={{
          ...styles.displayFace,
          fontSize: 26,
          marginTop: 2,
          color: balanceInk(day.balance),
        }}
      >
        {format(day.balance, 'financial')}
      </Text>
      <Rule style={{ margin: '10px 0' }} />
      {day.transactions.length === 0 && !spend ? (
        <TooltipLine name={t('Nothing scheduled')} amount="—" />
      ) : (
        day.transactions.map((b, j) => (
          <TooltipLine
            key={j}
            name={b.scheduleName || b.payee}
            amount={format(b.amount, 'financial')}
          />
        ))
      )}
      {spend ? (
        <TooltipLine
          name={t('What-if spend')}
          amount={format(-spend, 'financial')}
        />
      ) : null}
      <Text
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: theme.pageTextSubdued,
          marginTop: 6,
        }}
      >
        <Trans>Projected end of day, from your schedules.</Trans>
      </Text>
    </View>
  );
}

function TooltipLine({ name, amount }: { name: string; amount: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        padding: '2px 0',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: theme.pageText,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          ...styles.tnum,
          fontSize: 13,
          fontWeight: 600,
          color: theme.pageText,
          whiteSpace: 'nowrap',
        }}
      >
        {amount}
      </Text>
    </View>
  );
}
