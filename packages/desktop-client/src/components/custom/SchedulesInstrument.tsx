// Fork: the Schedules screen as an instrument. The figure is what the schedules
// will take out in the next 30 days; each row carries its own last six charges
// so a bill that has crept up is visible without opening it.
import { useMemo, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import type {
  ScheduleStatuses,
  ScheduleStatusType,
} from '@actual-app/core/shared/schedules';
import { titleFirst } from '@actual-app/core/shared/util';
import type {
  RecurConfig,
  ScheduleEntity,
} from '@actual-app/core/types/models';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { DisplayId } from '#components/util/DisplayId';
import type { ContextMenuItem } from '#contextmenu/types';
import { useContextMenu } from '#hooks/useContextMenu';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useQuery } from '#hooks/useQuery';
import { getRecurringDescription, getStatusLabel } from '#util/schedule';

import { cell, useCells } from './EnvelopeRowParts';
import {
  columnLabel,
  Direction,
  NoticeBar,
  PageHero,
  PillTabs,
  Sparkline,
  toneColors,
  wash,
} from './primitives';
import type { Tone } from './primitives';
import {
  chargedBetween,
  chargeHistory,
  groupCharges,
  historyWentWrong,
  scheduleCoverage,
  windowTotals,
} from './scheduleMath';
import type { Charge, Drift } from './scheduleMath';

// Re-exported: `#components/*` only resolves .tsx files.
export { detectDrift } from './scheduleMath';
export type { Charge, Drift } from './scheduleMath';

const WINDOW_DAYS = 30;
// Enough history for six monthly charges plus slack; weekly ones need less.
const HISTORY_DAYS = 400;

/** Every schedule-linked transaction in the last ~13 months, grouped. */
export function useScheduleCharges(): Map<string, Charge[]> {
  const since = monthUtils.subDays(monthUtils.currentDay(), HISTORY_DAYS);
  const { data } = useQuery<{
    schedule: string | null;
    date: string;
    amount: number;
  }>(
    () =>
      q('transactions')
        .filter({ schedule: { $ne: null }, date: { $gte: since } })
        .select(['schedule', 'date', 'amount'])
        .orderBy({ date: 'desc' }),
    [since],
  );
  return useMemo(() => groupCharges(data ?? []), [data]);
}

export type ScheduleFilter = 'all' | 'due' | 'drifting' | 'paid';

/** Which schedules a filter tab keeps. Completed ones only show under All. */
export function matchesScheduleFilter(
  filter: ScheduleFilter,
  status: ScheduleStatusType | undefined,
  drifting: boolean,
) {
  switch (filter) {
    case 'due':
      return status === 'due' || status === 'upcoming' || status === 'missed';
    case 'drifting':
      return drifting;
    case 'paid':
      return status === 'paid';
    default:
      return true;
  }
}

function money(format: ReturnType<typeof useFormat>, cents: number) {
  return format(cents, 'financial');
}

/** The top of the screen: the 30-day figure, its change, the filter tabs. */
export function SchedulesHero({
  schedules,
  statuses,
  charges,
  filter,
  onFilter,
  showDrifting,
  onAdd,
  onDiscover,
  search,
}: {
  schedules: readonly ScheduleEntity[];
  statuses: ScheduleStatuses;
  charges: Map<string, Charge[]>;
  filter: ScheduleFilter;
  onFilter: (filter: ScheduleFilter) => void;
  showDrifting: boolean;
  onAdd: () => void;
  onDiscover: () => void;
  /** The existing search box, set opposite the tabs. */
  search: ReactNode;
}) {
  const { t } = useTranslation();
  const format = useFormat();

  const today = monthUtils.currentDay();
  const until = monthUtils.addDays(today, WINDOW_DAYS);
  const totals = useMemo(
    () => windowTotals(schedules, statuses, today, until),
    [schedules, statuses, today, until],
  );

  // What the budget says a month of spending costs, against what the schedules
  // actually project. Every forward-looking surface reads schedules and nothing
  // else, so the shortfall is the part of the plan none of them can see.
  const budgetCell = cell(monthUtils.currentMonth(), 'total-budgeted');
  const budgetCells = useCells(useMemo(() => [budgetCell], [budgetCell]));
  const budgetedOutflow = -(budgetCells[budgetCell] ?? 0);
  const coverage = scheduleCoverage(totals.outflow, budgetedOutflow);
  const previous = useMemo(
    () =>
      chargedBetween(charges, monthUtils.subDays(today, WINDOW_DAYS), today),
    [charges, today],
  );
  const diff = totals.outflow - previous;

  const chipText = [
    totals.schedules === 1
      ? t('1 schedule')
      : t('{{count}} schedules', { count: totals.schedules }),
    totals.deposits > 0
      ? totals.deposits === 1
        ? t('1 deposit')
        : t('{{count}} deposits', { count: totals.deposits })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const options: Array<{ value: ScheduleFilter; label: string }> = [
    { value: 'all', label: t('All') },
    { value: 'due', label: t('Due soon') },
    ...(showDrifting
      ? [{ value: 'drifting' as const, label: t('Drifting') }]
      : []),
    { value: 'paid', label: t('Paid') },
  ];

  return (
    <View style={{ flexShrink: 0 }}>
      <PageHero
        label={t('Due in the next 30 days')}
        figure={<PrivacyFilter>{money(format, totals.outflow)}</PrivacyFilter>}
        action={
          <Button
            variant="primary"
            onPress={onAdd}
            style={{ height: 36, padding: '0 18px', fontSize: 14 }}
          >
            <Trans>Add schedule</Trans>
          </Button>
        }
      >
        {previous > 0 && diff !== 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* More going out is the bad direction here. */}
            <Direction
              up={diff > 0}
              color={diff > 0 ? theme.errorText : theme.noticeText}
            />
            <Text
              style={{
                ...styles.tnum,
                color: diff > 0 ? theme.errorText : theme.noticeText,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.012em',
                whiteSpace: 'nowrap',
              }}
            >
              <PrivacyFilter>
                {`${money(format, Math.abs(diff))} (${((Math.abs(diff) / previous) * 100).toFixed(1)}%)`}
              </PrivacyFilter>
            </Text>
            <Text
              style={{
                color: theme.pageTextLight,
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: '-0.012em',
                whiteSpace: 'nowrap',
              }}
            >
              {diff > 0
                ? t('more than the last 30 days')
                : t('less than the last 30 days')}
            </Text>
          </View>
        ) : null}
        {totals.schedules > 0 ? (
          <Text
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 12px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 650,
              whiteSpace: 'nowrap',
              backgroundColor: theme.surfaceSunken,
              color: theme.pageTextLight,
            }}
          >
            {chipText}
          </Text>
        ) : null}
      </PageHero>

      {schedules.length === 0 ? (
        <NoticeBar
          title={
            <Trans>
              Nothing is scheduled yet, so nothing ahead can be projected
            </Trans>
          }
          detail={
            <Trans>
              The calendar, the forecast and the low-balance alerts are all
              built from schedules. Actual can propose them from your own
              transaction history — it looks for the same payee and amount
              recurring on the same sort of date.
            </Trans>
          }
          action={
            <Button
              variant="primary"
              onPress={onDiscover}
              style={{ height: 34, padding: '0 16px', fontSize: 13 }}
            >
              <Trans>Find them in my transactions</Trans>
            </Button>
          }
        />
      ) : coverage && coverage.uncovered > 0 ? (
        <NoticeBar
          title={
            <PrivacyFilter>
              {t('{{amount}} of what you budget each month is not scheduled', {
                amount: money(format, coverage.uncovered),
              })}
            </PrivacyFilter>
          }
          detail={
            <PrivacyFilter>
              {t(
                'The schedules project {{scheduled}} over the next 30 days against the {{budgeted}} you have assigned this month. The calendar and the forecast can only see the scheduled part.',
                {
                  scheduled: money(format, totals.outflow),
                  budgeted: money(format, budgetedOutflow),
                },
              )}
            </PrivacyFilter>
          }
          action={
            <Button
              variant="primary"
              onPress={onDiscover}
              style={{ height: 34, padding: '0 16px', fontSize: 13 }}
            >
              <Trans>Find more in my transactions</Trans>
            </Button>
          }
        />
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 28,
        }}
      >
        <PillTabs
          label={t('Filter schedules')}
          options={options}
          value={filter}
          onChange={onFilter}
        />
        {search}
      </View>
    </View>
  );
}

/** The amber note for the schedule that has moved the most. */
export function DriftBanner({
  schedule,
  drift,
  onUpdate,
}: {
  schedule: ScheduleEntity;
  drift: Drift;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const up = drift.change > 0;
  const percent = `${(Math.abs(drift.change) * 100).toFixed(1)}%`;
  const month = monthUtils.format(drift.since, 'MMMM', locale);
  const name = schedule.name || t('A schedule');

  return (
    <View
      role="status"
      style={{
        marginTop: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        borderRadius: 14,
        flexShrink: 0,
        backgroundColor: wash(theme.warningBorder, 16, theme.pageBackground),
      }}
    >
      <Direction up={up} color={theme.warningText} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.014em',
            color: theme.warningText,
          }}
        >
          {up
            ? t('{{name}} has crept up {{percent}} since {{month}}', {
                name,
                percent,
                month,
              })
            : t('{{name}} has dropped {{percent}} since {{month}}', {
                name,
                percent,
                month,
              })}
        </Text>
        <Text
          style={{
            ...styles.tnum,
            fontSize: 13,
            fontWeight: 500,
            color: theme.warningText,
          }}
        >
          <PrivacyFilter>
            {t('{{from}} then, {{to}} now.', {
              from: money(format, drift.from),
              to: money(format, drift.to),
            })}
          </PrivacyFilter>
        </Text>
      </View>
      <Button
        variant="primary"
        onPress={onUpdate}
        style={{ flexShrink: 0, height: 32, padding: '0 14px', fontSize: 13 }}
      >
        <Trans>Update the schedule</Trans>
      </Button>
    </View>
  );
}

function statusTone(status: ScheduleStatusType | undefined): Tone {
  switch (status) {
    case 'due':
    case 'missed':
      return 'negative';
    case 'upcoming':
    case 'paid':
      return 'positive';
    default:
      return 'neutral';
  }
}

/** "Monthly", "Every 2 weeks" — the short form; the full rule is the title. */
function useFrequency() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  return (date: ScheduleEntity['_date']) => {
    if (!date || typeof date !== 'object') {
      return { short: t('Once'), full: t('Once') };
    }
    const config = date as RecurConfig;
    const n = config.interval || 1;
    let short: string;
    switch (config.frequency) {
      case 'daily':
        short = n === 1 ? t('Daily') : t('Every {{n}} days', { n });
        break;
      case 'weekly':
        short = n === 1 ? t('Weekly') : t('Every {{n}} weeks', { n });
        break;
      case 'monthly':
        short =
          n !== 1
            ? t('Every {{n}} months', { n })
            : (config.patterns?.length ?? 0) === 2
              ? t('Twice monthly')
              : t('Monthly');
        break;
      case 'yearly':
        short = n === 1 ? t('Yearly') : t('Every {{n}} years', { n });
        break;
      default:
        short = t('Recurring');
    }
    let full = short;
    try {
      full = getRecurringDescription(config, dateFormat, locale);
    } catch {
      // keep the short form
    }
    return { short, full };
  };
}

const COL = { name: 250, next: 130, amount: 130, status: 130, menu: 36 };

export type ScheduleInstrumentItem = ScheduleEntity | { id: 'show-completed' };

export function ScheduleInstrumentTable({
  items,
  statuses,
  charges,
  drifts,
  isLoading,
  emptyText,
  onSelect,
  onShowCompleted,
  menuItems,
}: {
  items: readonly ScheduleInstrumentItem[];
  statuses: ScheduleStatuses;
  charges: Map<string, Charge[]>;
  drifts: Map<string, Drift>;
  isLoading?: boolean;
  emptyText: string;
  onSelect: (id: ScheduleEntity['id']) => void;
  onShowCompleted: () => void;
  menuItems: (
    schedule: ScheduleEntity,
    status: ScheduleStatusType | undefined,
  ) => ContextMenuItem[];
}) {
  const frequency = useFrequency();

  return (
    <View style={{ flexShrink: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: '22px 4px 9px',
          borderBottom: `1px solid ${theme.tableBorder}`,
        }}
      >
        <Text style={{ ...columnLabel, width: COL.name, flexShrink: 0 }}>
          <Trans>Schedule</Trans>
        </Text>
        <Text style={{ ...columnLabel, width: COL.next, flexShrink: 0 }}>
          <Trans>Next</Trans>
        </Text>
        <Text
          style={{ ...columnLabel, flex: 1, minWidth: 0, textAlign: 'center' }}
        >
          <Trans>Last 6 charges</Trans>
        </Text>
        <Text
          style={{
            ...columnLabel,
            width: COL.amount,
            flexShrink: 0,
            textAlign: 'right',
          }}
        >
          <Trans>Amount</Trans>
        </Text>
        <View style={{ width: COL.status + COL.menu + 14, flexShrink: 0 }} />
      </View>

      {isLoading ? null : items.length === 0 ? (
        <Text
          style={{
            padding: '28px 4px',
            fontSize: 15,
            fontWeight: 500,
            color: theme.pageTextSubdued,
            textAlign: 'center',
          }}
        >
          {emptyText}
        </Text>
      ) : (
        items.map(item =>
          item.id === 'show-completed' ? (
            <button
              key="show-completed"
              type="button"
              onClick={onShowCompleted}
              style={{
                border: 0,
                background: 'transparent',
                font: 'inherit',
                cursor: 'pointer',
                padding: '16px 4px',
                fontSize: 13,
                fontWeight: 600,
                color: theme.pageTextLink,
                textAlign: 'center',
              }}
            >
              <Trans>Show completed schedules</Trans>
            </button>
          ) : (
            <ScheduleInstrumentRow
              key={item.id}
              schedule={item as ScheduleEntity}
              status={statuses.get(item.id)}
              charges={charges.get(item.id)}
              drifting={drifts.has(item.id)}
              frequency={frequency}
              onSelect={onSelect}
              menuItems={menuItems}
            />
          ),
        )
      )}
    </View>
  );
}

function ScheduleInstrumentRow({
  schedule,
  status,
  charges,
  drifting,
  frequency,
  onSelect,
  menuItems,
}: {
  schedule: ScheduleEntity;
  status: ScheduleStatusType | undefined;
  charges: Charge[] | undefined;
  drifting: boolean;
  frequency: ReturnType<typeof useFrequency>;
  onSelect: (id: ScheduleEntity['id']) => void;
  menuItems: (
    schedule: ScheduleEntity,
    status: ScheduleStatusType | undefined,
  ) => ContextMenuItem[];
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const rowRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useContextMenu({ triggerRef: rowRef, items: menuItems(schedule, status) });

  const num = getScheduledAmount(schedule._amount);
  const isIncome = num > 0;
  const op = schedule._amountOp;
  let amountText = format(Math.abs(num || 0), 'financial');
  if (
    op === 'isbetween' &&
    schedule._amount &&
    typeof schedule._amount === 'object'
  ) {
    amountText = `${format(Math.abs(schedule._amount.num1 || 0), 'financial')}–${format(Math.abs(schedule._amount.num2 || 0), 'financial')}`;
  }
  // signed like the register: + for money in, − for money out
  const prefix =
    (op === 'isapprox' ? '~' : '') + (isIncome ? '+' : num < 0 ? '−' : '');

  const history = chargeHistory(charges);
  const wrong = historyWentWrong(history, isIncome);
  const freq = frequency(schedule._date);

  const chipTone: Tone =
    drifting && (status === 'scheduled' || status === undefined)
      ? 'warning'
      : statusTone(status);
  const chipLabel =
    drifting && (status === 'scheduled' || status === undefined)
      ? t('Drifting')
      : titleFirst(getStatusLabel(status ?? ''));

  const sub = (
    <Text
      style={{
        // the payee renders as a block; flex keeps "payee · account" on one line
        display: 'flex',
        fontSize: 13,
        fontWeight: 500,
        color: theme.pageTextSubdued,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {schedule._payee ? (
        <DisplayId type="payees" id={schedule._payee} />
      ) : null}
      {schedule._payee && schedule._account ? '\u00a0·\u00a0' : null}
      {schedule._account ? (
        <DisplayId type="accounts" id={schedule._account} />
      ) : null}
    </Text>
  );

  return (
    <View
      innerRef={rowRef}
      tabIndex={0}
      aria-label={schedule.name || t('None')}
      onClick={() => onSelect(schedule.id)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.target === e.currentTarget && e.key === 'Enter') {
          onSelect(schedule.id);
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: '16px 4px',
        borderBottom: `1px solid ${theme.tableBorder}`,
        cursor: 'pointer',
        flexShrink: 0,
        outline: 'none',
        ':hover': { backgroundColor: theme.tableRowBackgroundHover },
        ':focus-visible': {
          boxShadow: `inset 0 0 0 2px ${theme.formInputBorderSelected}`,
        },
      }}
    >
      <View style={{ width: COL.name, flexShrink: 0, gap: 2, minWidth: 0 }}>
        <Text
          title={schedule.name || ''}
          style={{
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '-0.018em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: schedule.name ? theme.pageText : theme.pageTextSubdued,
          }}
        >
          {schedule.name || t('None')}
        </Text>
        {sub}
      </View>

      <View style={{ width: COL.next, flexShrink: 0, gap: 2, minWidth: 0 }}>
        <Text
          title={
            schedule.next_date
              ? monthUtils.format(schedule.next_date, dateFormat)
              : undefined
          }
          style={{
            ...styles.tnum,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.014em',
            whiteSpace: 'nowrap',
            color: theme.pageText,
          }}
        >
          {schedule.next_date
            ? monthUtils.format(schedule.next_date, 'd MMM', locale)
            : '—'}
        </Text>
        <Text
          title={freq.full}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: theme.pageTextSubdued,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {freq.short}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={
          history.length
            ? t('Last {{n}} charges: {{list}}', {
                n: history.length,
                list: history.map(v => format(v, 'financial')).join(', '),
              })
            : t('No linked charges yet')
        }
      >
        {history.length >= 2 ? (
          <PrivacyFilter>
            <Sparkline
              values={history}
              width={130}
              height={22}
              color={wrong ? theme.errorBorder : theme.reportsChartFill}
            />
          </PrivacyFilter>
        ) : (
          <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>—</Text>
        )}
      </View>

      <Text
        title={
          op === 'isapprox'
            ? t('Approximately {{currencyAmount}}', {
                currencyAmount: amountText,
              })
            : amountText
        }
        style={{
          ...styles.tnum,
          width: COL.amount,
          flexShrink: 0,
          textAlign: 'right',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: isIncome ? theme.noticeText : theme.pageText,
        }}
      >
        <PrivacyFilter>
          {prefix}
          {amountText}
        </PrivacyFilter>
      </Text>

      <View
        style={{
          width: COL.status,
          flexShrink: 0,
          flexDirection: 'row',
          justifyContent: 'flex-end',
        }}
      >
        {status ? (
          <StatusChipLarge tone={chipTone}>{chipLabel}</StatusChipLarge>
        ) : null}
      </View>

      <View style={{ width: COL.menu, flexShrink: 0 }}>
        <Button
          ref={buttonRef}
          variant="bare"
          aria-label={t('Menu')}
          onPress={() => {
            if (rowRef.current) {
              const rect = buttonRef.current?.getBoundingClientRect();
              rowRef.current.dispatchEvent(
                new MouseEvent('contextmenu', {
                  bubbles: true,
                  clientX: rect ? rect.left : 0,
                  clientY: rect ? rect.bottom : 0,
                }),
              );
            }
          }}
          style={{ width: 36, height: 36, borderRadius: 999 }}
        >
          <SvgDotsHorizontalTriple
            width={15}
            height={15}
            style={{ transform: 'rotateZ(90deg)', color: theme.pageTextLight }}
          />
        </Button>
      </View>
    </View>
  );
}

/** The mock's row chip is a step larger than `StatusChip`'s table size. */
function StatusChipLarge({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  const { fg, bg } = toneColors(tone);
  return (
    <Text
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        padding: '0 11px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 650,
        whiteSpace: 'nowrap',
        color: fg,
        backgroundColor: bg,
      }}
    >
      {children}
    </Text>
  );
}
