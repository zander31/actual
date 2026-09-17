// Fork addition: cash curve = upstream schedules forecast, overlaid with the
// rolling 3-month rate of everything the schedules do not cover — net, both
// signs — as best / expected / worst bands, plus projected month-end balances
// across the chosen horizon.
//
// The page has one job: say whether the money runs out and when. The figure
// leads (and follows the pointer along the curve), the curve changes colour at
// zero, the crossing is marked, and everything else recedes to hairlines.
import { useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
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

import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { aqlQuery } from '#queries/aqlQuery';

import {
  combineByDate,
  hasScheduledIncome,
  MIN_SAMPLE_MONTHS,
  monthEnds,
  monthlyNet,
  netFlowRates,
  projectBands,
} from './forecastMath';
import type { BandPoint, NetRates } from './forecastMath';
import {
  chip,
  columnLabel,
  DashSwatch,
  Direction,
  HeroNumber,
  LegendRow,
  NoticeBar,
  PillTabs,
  SectionHeader,
  sectionLabel,
  Swatch,
  wash,
} from './primitives';

const HISTORY_MONTHS = 3;

type Horizon = '30D' | '60D' | '90D' | '1Y';
const HORIZON_DAYS: Record<Horizon, number> = {
  '30D': 30,
  '60D': 60,
  '90D': 90,
  '1Y': 365,
};

const CHART_HEIGHT = 236;
const CHART_PAD = 20;

export function ForecastPage() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const format = useFormat();
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const onBudget = useMemo(
    () => accounts.filter(a => !a.closed && !a.offbudget),
    [accounts],
  );

  const [accountId, setAccountId] = useState<string>('');
  const [horizon, setHorizon] = useState<Horizon>('90D');
  const [points, setPoints] = useState<ForecastDataPoint[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [sampleMonths, setSampleMonths] = useState<string[]>([]);
  const [scrub, setScrub] = useState<number | null>(null);
  const days = HORIZON_DAYS[horizon];

  useEffect(() => {
    if (!accountId && onBudget.length) {
      setAccountId(onBudget.find(a => /check/i.test(a.name))?.id ?? 'all');
    }
  }, [accountId, onBudget]);

  const accountIds = useMemo(
    () =>
      !accountId
        ? []
        : accountId === 'all'
          ? onBudget.map(a => a.id)
          : [accountId],
    [accountId, onBudget],
  );

  useEffect(() => {
    if (!accountIds.length) return;
    const today = monthUtils.currentDay();
    let cancelled = false;
    void send('forecast/generate', {
      accountIds,
      startDate: today,
      endDate: monthUtils.addDays(today, days),
    }).then(res => {
      if (!cancelled) {
        setScrub(null);
        setPoints(res.dataPoints);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountIds, days]);

  useEffect(() => {
    if (!accountIds.length) return;
    const today = monthUtils.currentDay();
    const thisMonth = monthUtils.currentMonth();
    const months = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
      monthUtils.subMonths(thisMonth, HISTORY_MONTHS - i),
    );
    const thisMonthStart = monthUtils.firstDayOfMonth(today);
    const historyStart = monthUtils.firstDayOfMonth(months[0]);
    let cancelled = false;
    // Everything the schedules do not already project, over the last complete
    // months, on the same accounts — inflows included. Taking only the
    // outflows made this subtract a household's whole cost of living while
    // adding none of its earnings, so any file whose pay is not a schedule
    // projected straight through zero however much it actually took in.
    void aqlQuery(
      q('transactions')
        .filter({
          $and: [
            { date: { $gte: historyStart } },
            { date: { $lt: thisMonthStart } },
          ],
          schedule: null,
          transfer_id: null,
          is_parent: false,
          account: { $oneof: accountIds },
        })
        .select(['date', 'amount']),
    ).then(({ data }) => {
      if (!cancelled) {
        setSampleMonths(months);
        setHistory(
          monthlyNet(data as { date: string; amount: number }[], months),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountIds]);

  const rates: NetRates | null = useMemo(
    () => netFlowRates(history),
    [history],
  );
  const combined = useMemo(() => combineByDate(points), [points]);
  const bands = useMemo(() => projectBands(combined, rates), [combined, rates]);
  const noIncomeSchedule = useMemo(
    () => points.length > 0 && !hasScheduledIncome(combined),
    [points.length, combined],
  );
  // only whole months: a month the horizon cuts off part-way hasn't landed
  const ends = useMemo(
    () =>
      monthEnds(bands, 12).filter(
        e => e.date === monthUtils.lastDayOfMonth(e.date),
      ),
    [bands],
  );

  // the answer the page exists to give
  const crossingIndex = bands.findIndex(b => b.expected < 0);
  const crossing = crossingIndex >= 0 ? bands[crossingIndex] : null;
  const lowestIndex = bands.reduce(
    (m, b, i) => (b.expected < bands[m].expected ? i : m),
    0,
  );
  const shownIndex =
    scrub != null && scrub < bands.length ? scrub : lowestIndex;
  const shown = bands.length ? bands[shownIndex] : null;
  const last = bands.length ? bands[bands.length - 1] : null;
  const lastDate = last?.date ?? null;

  const horizonLabel = {
    '30D': t('30 days'),
    '60D': t('60 days'),
    '90D': t('90 days'),
    '1Y': t('a year'),
  }[horizon];
  const shortDate = (d: string) => monthUtils.format(d, 'd MMM');
  const longDate = (d: string) => monthUtils.format(d, 'EEEE, d MMMM');

  const accountSelect = (
    <Select
      value={accountId}
      onChange={v => setAccountId(v)}
      options={[
        ['all', t('All on-budget accounts')],
        ...onBudget.map(a => [a.id, a.name] as [string, string]),
      ]}
    />
  );

  const heroInk =
    shown && shown.expected < 0 ? theme.errorText : theme.pageText;

  /** A signed per-day rate, read as money either way. */
  const perDay = (cents: number) =>
    format(Math.round(cents), 'financial-no-decimals');

  return (
    <Page
      header={isNarrowWidth ? t('Forecast') : null}
      padding={isNarrowWidth ? undefined : 24}
    >
      <View
        style={{
          paddingTop: isNarrowWidth ? 16 : 26,
          paddingBottom: 60,
          flexShrink: 0,
        }}
      >
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
            <Text
              style={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '-0.008em',
                color: theme.pageTextSubdued,
                whiteSpace: 'nowrap',
              }}
            >
              {scrub != null && shown
                ? t('Projected balance on {{date}}', {
                    date: shortDate(shown.date),
                  })
                : t('Projected balance')}
            </Text>
            <HeroNumber color={heroInk}>
              {shown ? format(shown.expected, 'financial') : ' '}
            </HeroNumber>
            {shown && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Direction
                    up={shown.expected >= bands[0].expected}
                    color={heroInk}
                  />
                  <Text
                    style={{
                      ...styles.tnum,
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: '-0.012em',
                      whiteSpace: 'nowrap',
                      color: heroInk,
                    }}
                  >
                    {shortDate(shown.date)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      letterSpacing: '-0.012em',
                      whiteSpace: 'nowrap',
                      color: theme.pageTextLight,
                    }}
                  >
                    {scrub != null
                      ? t('from today')
                      : t('lowest in {{horizon}}', { horizon: horizonLabel })}
                  </Text>
                </View>
                {crossing && (
                  <Text
                    style={{
                      ...chip,
                      fontWeight: 650,
                      whiteSpace: 'nowrap',
                      backgroundColor: wash(
                        theme.errorBorder,
                        14,
                        theme.pageBackground,
                      ),
                      color: theme.errorText,
                    }}
                  >
                    <Trans>Runs out {{ when: shortDate(crossing.date) }}</Trans>
                  </Text>
                )}
              </View>
            )}
          </View>
          <View style={{ flexShrink: 0 }}>{accountSelect}</View>
        </View>

        <BandChart
          bands={bands}
          shownIndex={shownIndex}
          scrubbing={scrub != null}
          crossingIndex={crossingIndex}
          onScrub={setScrub}
          describe={b =>
            t(
              '{{date}}: expected {{expected}}, worst {{worst}}, best {{best}}',
              {
                date: longDate(b.date),
                expected: format(b.expected, 'financial'),
                worst: format(b.worst, 'financial'),
                best: format(b.best, 'financial'),
              },
            )
          }
        />

        <PillTabs
          label={t('Forecast horizon')}
          value={horizon}
          onChange={setHorizon}
          options={(Object.keys(HORIZON_DAYS) as Horizon[]).map(h => ({
            value: h,
            label: h,
          }))}
          style={{ marginTop: 10 }}
        />

        {noIncomeSchedule && (
          <NoticeBar
            title={
              <Trans>
                No income is scheduled in this horizon, so this curve is bills
                only
              </Trans>
            }
            detail={
              <Trans>
                A forecast built from outgoings alone can only ever run out. Add
                your pay as a schedule and the line will show what actually
                arrives.
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

        {last && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              columnGap: 30,
              rowGap: 8,
              marginTop: 22,
              flexShrink: 0,
            }}
          >
            <LegendRow
              swatch={<Swatch color={theme.reportsChartFill} />}
              value={t('{{worst}} to {{best}}', {
                worst: format(last.worst, 'financial-no-decimals'),
                best: format(last.best, 'financial-no-decimals'),
              })}
              label={t('range in {{horizon}}', { horizon: horizonLabel })}
            />
            <LegendRow
              swatch={<DashSwatch color={theme.pageTextSubdued} />}
              value={format(last.schedules, 'financial-no-decimals')}
              label={t('schedules alone')}
            />
          </View>
        )}

        {ends.length > 0 && (
          <MonthLands
            ends={ends}
            narrow={isNarrowWidth}
            format={v => format(v, 'financial-no-decimals')}
          />
        )}

        <View
          style={{
            marginTop: 22,
            padding: '16px 18px',
            borderRadius: 14,
            backgroundColor: theme.surfaceSunken,
            gap: 5,
            maxWidth: 640,
            flexShrink: 0,
          }}
        >
          <Text style={{ ...sectionLabel }}>
            <Trans>How this is worked out</Trans>
          </Text>
          <Text
            style={{
              color: theme.pageTextLight,
              lineHeight: 1.55,
              fontSize: 13,
            }}
          >
            {rates ? (
              <Trans>
                The dashed line is your schedules alone, from the same engine as
                the Balance Forecast report. The band adds everything the
                schedules do not cover — money in as well as out — taking your
                best, average and worst of the {{ n: history.length }} complete
                months to{' '}
                {{
                  sampleEnd: monthUtils.format(
                    sampleMonths[history.length - 1] ?? '',
                    'MMMM',
                  ),
                }}
                , spread evenly per day: {{ best: perDay(rates.best) }},{' '}
                {{ expected: perDay(rates.expected) }} and{' '}
                {{ worst: perDay(rates.worst) }} a day.
              </Trans>
            ) : (
              <Trans>
                The dashed line is your schedules alone, from the same engine as
                the Balance Forecast report. There are not yet{' '}
                {{ need: MIN_SAMPLE_MONTHS }} complete months of history outside
                those schedules, so no band is drawn — one month would make
                best, expected and worst the same figure and read as certainty
                this file cannot support.
              </Trans>
            )}
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

/**
 * The forecast instrument: a best/worst band washed green above zero and red
 * below it, the expected line changing colour exactly at zero, schedules alone
 * dotted, and the crossing marked. Hovering (or arrow keys) scrubs the hero.
 */
function BandChart({
  bands,
  shownIndex,
  scrubbing,
  crossingIndex,
  onScrub,
  describe,
}: {
  bands: BandPoint[];
  shownIndex: number;
  scrubbing: boolean;
  crossingIndex: number;
  onScrub: (index: number | null) => void;
  describe: (b: BandPoint) => string;
}) {
  const id = useId().replace(/:/g, '');
  const n = bands.length;
  const recess = {
    position: 'relative' as const,
    height: CHART_HEIGHT,
    marginTop: 22,
    flexShrink: 0,
    backgroundColor: theme.surfaceSunken,
    borderRadius: 16,
    overflow: 'hidden' as const,
  };
  if (n < 2) {
    return <View style={recess} />;
  }

  // zero always sits inside the plotted range: distance to it is the point
  const hi = Math.max(0, ...bands.map(b => b.best));
  const lo = Math.min(0, ...bands.map(b => b.worst));
  const span = hi - lo || 1;
  const x = (i: number) => (i / (n - 1)) * 1000;
  const y = (v: number) =>
    CHART_HEIGHT -
    CHART_PAD -
    ((v - lo) / span) * (CHART_HEIGHT - 2 * CHART_PAD);
  const path = (vals: number[]) =>
    vals
      .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ');
  const band =
    path(bands.map(b => b.best)) +
    ' ' +
    bands
      .map((_, k) => {
        const i = n - 1 - k;
        return `L${x(i).toFixed(1)} ${y(bands[i].worst).toFixed(1)}`;
      })
      .join(' ') +
    ' Z';
  const zeroY = y(0);
  const zeroOffset = Math.max(0, Math.min(1, zeroY / CHART_HEIGHT));

  // where the expected line actually meets zero, between the two days
  let crossX: number | null = null;
  if (crossingIndex === 0) {
    crossX = 0;
  } else if (crossingIndex > 0) {
    const a = bands[crossingIndex - 1].expected;
    const b = bands[crossingIndex].expected;
    crossX = x(crossingIndex - 1 + a / (a - b));
  }

  const shown = bands[shownIndex];
  const pct = (px: number) => `${(px / 10).toFixed(2)}%`;
  const dotFill =
    shown.expected < 0 ? theme.errorBorder : theme.reportsChartFill;

  return (
    <View
      role="img"
      tabIndex={0}
      aria-label={describe(shown)}
      onMouseMove={(e: MouseEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        onScrub(Math.round(t * (n - 1)));
      }}
      onMouseLeave={() => onScrub(null)}
      onBlur={() => onScrub(null)}
      onKeyDown={(e: KeyboardEvent) => {
        const step: Record<string, number> = {
          ArrowLeft: Math.max(0, shownIndex - 1),
          ArrowRight: Math.min(n - 1, shownIndex + 1),
          Home: 0,
          End: n - 1,
        };
        if (e.key in step) {
          e.preventDefault();
          onScrub(step[e.key]);
        } else if (e.key === 'Escape') {
          onScrub(null);
        }
      }}
      style={{
        ...recess,
        cursor: 'crosshair',
        outline: 'none',
        ':focus-visible': {
          boxShadow: `0 0 0 2px ${theme.formInputBorderSelected}`,
        },
      }}
    >
      <svg
        viewBox={`0 0 1000 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ width: '100%', height: CHART_HEIGHT, display: 'block' }}
      >
        <defs>
          {/* one hard stop exactly at zero, in chart space so the band and
              the line share it: above is money you have, below is not */}
          <linearGradient
            id={`${id}-band`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={CHART_HEIGHT}
          >
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
          <linearGradient
            id={`${id}-line`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={CHART_HEIGHT}
          >
            <stop offset={zeroOffset} stopColor={theme.reportsChartFill} />
            <stop offset={zeroOffset} stopColor={theme.errorBorder} />
          </linearGradient>
        </defs>
        {[40, 130].map(gy => (
          <line
            key={gy}
            x1="0"
            x2="1000"
            y1={gy}
            y2={gy}
            stroke={theme.pageTextSubdued}
            strokeOpacity="0.35"
            strokeDasharray="1 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={band} fill={`url(#${id}-band)`} />
        <line
          x1="0"
          x2="1000"
          y1={zeroY}
          y2={zeroY}
          stroke={theme.pageText}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(bands.map(b => b.schedules))}
          fill="none"
          stroke={theme.pageTextLight}
          strokeWidth="2"
          strokeDasharray="1 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(bands.map(b => b.expected))}
          fill="none"
          stroke={`url(#${id}-line)`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* drawn in HTML so the marks stay round when the SVG stretches */}
      {crossX != null && (
        <>
          <Dot
            left={pct(crossX)}
            top={zeroY}
            size={24}
            color={theme.errorBorder}
            opacity={0.18}
          />
          <Dot
            left={pct(crossX)}
            top={zeroY}
            size={10}
            color={theme.errorBorder}
            ring
          />
        </>
      )}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 1,
          left: pct(x(shownIndex)),
          backgroundColor: theme.tableBorderHover,
          opacity: scrubbing ? 1 : 0,
          pointerEvents: 'none',
        }}
      />
      <Dot
        left={pct(x(shownIndex))}
        top={y(shown.expected)}
        size={11}
        color={dotFill}
        ring
      />
    </View>
  );
}

function Dot({
  left,
  top,
  size,
  color,
  opacity = 1,
  ring = false,
}: {
  left: string;
  top: number;
  size: number;
  color: string;
  opacity?: number;
  ring?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: color,
        opacity,
        boxShadow: ring ? `0 0 0 2px ${theme.surfaceSunken}` : undefined,
        transform: `translate(-${size / 2}px, -${size / 2}px)`,
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Month-end landings: each row's worst→best range as a washed capsule on a
 * shared scale, an ink tick at expected, then the three figures.
 */
function MonthLands({
  ends,
  narrow,
  format,
}: {
  ends: BandPoint[];
  narrow: boolean;
  format: (v: number) => string;
}) {
  const { t } = useTranslation();
  const lo = Math.min(0, ...ends.map(e => e.worst));
  const hi = Math.max(0, ...ends.map(e => e.best));
  const pad = (hi - lo) * 0.05 || 1;
  const pos = (v: number) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  const figureWidth = narrow ? 72 : 120;
  const figure = {
    ...styles.tnum,
    width: figureWidth,
    flexShrink: 0,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  };
  const gap = narrow ? 10 : 22;
  const monthWidth = narrow ? 44 : 200;

  return (
    <View style={{ flexShrink: 0 }}>
      <SectionHeader label={t('Where each month lands')} />
      <View
        aria-hidden="true"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap,
          padding: '12px 4px 0',
        }}
      >
        <View style={{ width: monthWidth, flexShrink: 0 }} />
        <View style={{ flex: 1, minWidth: 0 }} />
        {[t('Worst'), t('Expected'), t('Best')].map(h => (
          <Text key={h} style={{ ...columnLabel, ...figure }}>
            {h}
          </Text>
        ))}
      </View>
      {ends.map(e => {
        const left = pos(e.worst);
        const fill =
          e.expected < 0 ? theme.errorBorder : theme.reportsChartFill;
        const month = e.date.slice(0, 7);
        return (
          <View
            key={e.date}
            role="group"
            aria-label={t(
              '{{month}}: worst {{worst}}, expected {{expected}}, best {{best}}',
              {
                month: monthUtils.format(month, 'MMMM yyyy'),
                worst: format(e.worst),
                expected: format(e.expected),
                best: format(e.best),
              },
            )}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap,
              padding: narrow ? '14px 0' : '18px 4px',
              borderBottom: `1px solid ${theme.tableBorder}`,
            }}
          >
            <Text
              style={{
                width: monthWidth,
                flexShrink: 0,
                fontSize: narrow ? 15 : 17,
                fontWeight: 600,
                letterSpacing: '-0.018em',
                whiteSpace: 'nowrap',
                color: theme.pageText,
              }}
            >
              {monthUtils.format(month, narrow ? 'MMM' : 'MMMM yyyy')}
            </Text>
            <View
              style={{
                flex: 1,
                minWidth: 0,
                position: 'relative',
                height: 10,
                borderRadius: 999,
                backgroundColor: theme.surfaceSunken,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  height: 10,
                  borderRadius: 999,
                  left: `${left}%`,
                  width: `${Math.max(0, pos(e.best) - left)}%`,
                  backgroundColor: wash(fill, 35, theme.surfaceSunken),
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: -3,
                  width: 3,
                  height: 16,
                  borderRadius: 2,
                  backgroundColor: theme.pageText,
                  left: `${pos(e.expected)}%`,
                  transform: 'translateX(-1.5px)',
                }}
              />
            </View>
            <Text
              style={{
                ...figure,
                fontSize: 15,
                fontWeight: 500,
                color: e.worst < 0 ? theme.errorText : theme.pageTextSubdued,
              }}
            >
              {format(e.worst)}
            </Text>
            <Text
              style={{
                ...figure,
                fontSize: narrow ? 15 : 17,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: e.expected < 0 ? theme.errorText : theme.pageText,
              }}
            >
              {format(e.expected)}
            </Text>
            <Text
              style={{
                ...figure,
                fontSize: 15,
                fontWeight: 500,
                color: theme.pageTextSubdued,
              }}
            >
              {format(e.best)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
