// The envelope budget as an instrument: the month's answer first (left to
// assign, what changed, the one move to make), a single bar for where the money
// is, then the envelopes each carrying their own six months of history. A rail
// beside it holds what needs a decision and what leaves before the next pay.
//
// Everything here reads the same spreadsheet cells and fires the same budget
// actions the upstream summary and table do — it is a presentation of them.
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import type {
  CategoryEntity,
  ScheduleEntity,
} from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { EnvelopeMonthMenu } from '#components/budget/envelope/budgetsummary/BudgetSummary';
import { ToBudgetMenuSteps } from '#components/budget/envelope/budgetsummary/ToBudget';
import { TotalsList } from '#components/budget/envelope/budgetsummary/TotalsList';
import { CoverMenu } from '#components/budget/envelope/CoverMenu';
import { useEnvelopeBudget } from '#components/budget/envelope/EnvelopeBudgetContext';
import { NotesButton } from '#components/NotesButton';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useCategories } from '#hooks/useCategories';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useOnBudgetAccounts } from '#hooks/useOnBudgetAccounts';
import { usePayeesById } from '#hooks/usePayees';
import { useQuery } from '#hooks/useQuery';
import { useSchedules } from '#hooks/useSchedules';
import { SheetNameProvider } from '#hooks/useSheetName';
import { pushModal } from '#modals/modalsSlice';
import { uncategorizedTransactions } from '#queries';
import { useDispatch } from '#redux';

import { cell, useCells } from './EnvelopeRowParts';
import {
  columnLabel,
  Delta,
  HeroNumber,
  LegendRow,
  sectionLabel,
  Swatch,
  wash,
} from './primitives';
import { findLeaks, reconcile } from './reconcileMath';
import type { LeakRow } from './reconcileMath';

/** The rail's width, and the gap it keeps from the envelopes. */
export const BUDGET_RAIL_WIDTH = 340;
export const BUDGET_RAIL_GAP = 28;

// ── Hero ────────────────────────────────────────────────────────────────────

function RoundTrigger({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="bare"
      aria-label={label}
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: 999,
        flexShrink: 0,
        justifyContent: 'center',
        alignItems: 'center',
        color: theme.pageTextLight,
        backgroundColor: theme.surfaceSunken,
      }}
    >
      {children}
    </Button>
  );
}

/**
 * Left to assign for the month, its change against the month before, and the
 * one move that answers it. The figure keeps the summary's breakdown on hover.
 */
export function BudgetHero({ month }: { month: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const { onBudgetAction } = useEnvelopeBudget();

  const prev = monthUtils.prevMonth(month);
  const cells = useCells([cell(month, 'to-budget'), cell(prev, 'to-budget')]);
  const left = cells[cell(month, 'to-budget')] ?? 0;
  const prevLeft = cells[cell(prev, 'to-budget')];

  const [assignOpen, setAssignOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const assignRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const monthName = monthUtils.format(month, 'MMMM', locale);
  const prevName = monthUtils.format(prev, 'MMMM', locale);
  const ink =
    left > 0
      ? theme.noticeText
      : left < 0
        ? theme.errorText
        : theme.pageTextSubdued;

  const diff = prevLeft == null ? null : left - prevLeft;
  const percent =
    diff == null || !prevLeft
      ? undefined
      : `${((diff / Math.abs(prevLeft)) * 100).toFixed(1)}%`;

  const assignLabel =
    left > 0
      ? t('Assign {{amount}}', { amount: format(left, 'financial') })
      : left < 0
        ? t('Cover {{amount}}', { amount: format(-left, 'financial') })
        : t('Nothing to assign');

  return (
    <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
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
            {left < 0
              ? t('Overbudgeted · {{month}}', { month: monthName })
              : t('Left to assign · {{month}}', { month: monthName })}
          </Text>
          <Tooltip
            content={
              <TotalsList prevMonthName={prevName} style={{ padding: 7 }} />
            }
            placement="bottom start"
            offset={3}
            triggerProps={{ isDisabled: assignOpen }}
          >
            <View style={{ alignSelf: 'flex-start' }}>
              <PrivacyFilter>
                <HeroNumber color={ink}>{format(left, 'financial')}</HeroNumber>
              </PrivacyFilter>
            </View>
          </Tooltip>
          {diff != null ? (
            <PrivacyFilter>
              <Delta
                up={diff >= 0}
                amount={format(Math.abs(diff), 'financial')}
                percent={percent}
                period={t('vs {{month}}', { month: prevName })}
              />
            </PrivacyFilter>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View ref={assignRef}>
            <Button
              variant="primary"
              onPress={() => setAssignOpen(true)}
              style={{
                height: 36,
                padding: '0 18px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 650,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              <PrivacyFilter>{assignLabel}</PrivacyFilter>
            </Button>
          </View>
          <Popover
            triggerRef={assignRef}
            placement="bottom end"
            isOpen={assignOpen}
            onOpenChange={() => setAssignOpen(false)}
            style={{ width: 220, margin: 1 }}
            isNonModal
          >
            <ToBudgetMenuSteps
              month={month}
              onBudgetAction={onBudgetAction}
              onClose={() => setAssignOpen(false)}
            />
          </Popover>

          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.surfaceSunken,
            }}
          >
            <NotesButton
              id={`budget-${month}`}
              width={14}
              height={14}
              tooltipPosition="bottom end"
              defaultColor={theme.pageTextLight}
            />
          </View>

          <View ref={menuRef}>
            <RoundTrigger
              label={t('Month menu')}
              onPress={() => setMenuOpen(true)}
            >
              <SvgDotsHorizontalTriple width={15} height={15} />
            </RoundTrigger>
          </View>
          <Popover
            triggerRef={menuRef}
            placement="bottom end"
            isOpen={menuOpen}
            onOpenChange={() => setMenuOpen(false)}
          >
            <EnvelopeMonthMenu
              month={month}
              onClose={() => setMenuOpen(false)}
            />
          </Popover>
        </View>
      </View>
    </SheetNameProvider>
  );
}

// ── Where the month stands ──────────────────────────────────────────────────

const card = {
  backgroundColor: theme.cardBackground,
  borderRadius: 16,
  boxShadow: `inset 0 0 0 1px ${theme.cardBorder}`,
};

const segment = {
  height: '100%',
  transition: 'width .3s cubic-bezier(0.22,1,0.36,1)',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
};

/**
 * One bar for the whole month: what has already gone, what is still sitting in
 * envelopes, and what has not been given a job yet.
 */
export function MonthStandsCard({ month }: { month: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const prev = monthUtils.prevMonth(month);
  const cells = useCells([
    cell(month, 'total-budgeted'),
    cell(month, 'available-funds'),
    cell(month, 'total-spent'),
    cell(month, 'total-leftover'),
    cell(month, 'to-budget'),
    cell(month, 'last-month-overspent'),
  ]);
  const assigned = -(cells[cell(month, 'total-budgeted')] ?? 0);
  const available = cells[cell(month, 'available-funds')] ?? 0;
  const spent = Math.max(0, -(cells[cell(month, 'total-spent')] ?? 0));
  const held = Math.max(0, cells[cell(month, 'total-leftover')] ?? 0);
  const free = cells[cell(month, 'to-budget')] ?? 0;
  // Upstream already works this out and nothing ever showed it: envelopes left
  // overspent last month come straight off this month's available money.
  const carriedOverspend = -(cells[cell(month, 'last-month-overspent')] ?? 0);
  const total = spent + held + Math.max(0, free) || 1;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  const spentText = format(spent, 'financial');
  const heldText = format(held, 'financial');
  const freeText = format(free, 'financial');

  return (
    <View style={{ ...card, marginTop: 26, padding: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
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
          <Trans>Where the month stands</Trans>
        </Text>
        <PrivacyFilter>
          <Text
            style={{ ...columnLabel, ...styles.tnum, whiteSpace: 'nowrap' }}
          >
            {t('{{assigned}} assigned of {{available}} available', {
              assigned: format(assigned, 'financial'),
              available: format(available, 'financial'),
            })}
          </Text>
        </PrivacyFilter>
      </View>
      <View
        role="img"
        aria-label={t(
          '{{spent}} already spent, {{held}} still in envelopes, {{free}} unassigned',
          { spent: spentText, held: heldText, free: freeText },
        )}
        style={{
          flexDirection: 'row',
          height: 26,
          marginTop: 14,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: theme.surfaceSunken,
        }}
      >
        <View
          style={{
            ...segment,
            width: pct(spent),
            background: `linear-gradient(177deg, ${wash(theme.reportsChartFill, 62, theme.cardBackground)} 0%, ${theme.reportsChartFill} 26%, ${wash(theme.reportsChartFill, 88, theme.pageText)} 100%)`,
          }}
        />
        <View
          style={{
            ...segment,
            width: pct(held),
            backgroundColor: theme.warningBorder,
          }}
        />
        <View
          style={{
            ...segment,
            width: pct(Math.max(0, free)),
            backgroundColor: theme.tableBorder,
          }}
        />
      </View>
      <PrivacyFilter>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: '10px 26px',
            marginTop: 14,
          }}
        >
          <LegendRow
            swatch={<Swatch color={theme.reportsChartFill} />}
            value={spentText}
            label={t('already spent')}
          />
          <LegendRow
            swatch={<Swatch color={theme.warningBorder} />}
            value={heldText}
            label={t('still in envelopes')}
          />
          <LegendRow
            swatch={<Swatch color={theme.tableBorder} />}
            value={freeText}
            label={free < 0 ? t('overbudgeted') : t('unassigned')}
          />
        </View>
      </PrivacyFilter>
      {carriedOverspend > 0 ? (
        <PrivacyFilter>
          <Text
            style={{
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.45,
              color: theme.errorText,
              marginTop: 12,
            }}
          >
            {t(
              '{{amount}} of this available has already gone to cover envelopes left overspent in {{month}}.',
              {
                amount: format(carriedOverspend, 'financial'),
                month: monthUtils.format(prev, 'MMMM', locale),
              },
            )}
          </Text>
        </PrivacyFilter>
      ) : null}
    </View>
  );
}

/** "Envelopes ──── 6 months of spend" */
export function EnvelopesSectionHeader({
  showHistory,
}: {
  showHistory: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        margin: '30px 0 4px',
      }}
    >
      <Text
        style={{
          ...sectionLabel,
          color: theme.pageTextSubdued,
          whiteSpace: 'nowrap',
        }}
      >
        <Trans>Envelopes</Trans>
      </Text>
      <View
        style={{ flex: 1, height: 1, backgroundColor: theme.tableBorder }}
      />
      {showHistory ? (
        <Text style={{ ...columnLabel, whiteSpace: 'nowrap' }}>
          <Trans>6 months of spend</Trans>
        </Text>
      ) : null}
    </View>
  );
}

// ── Rail ────────────────────────────────────────────────────────────────────

function RailCard({
  title,
  count,
  countColor = theme.pageTextSubdued,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  countColor?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ ...card, overflow: 'hidden' }}>
      <View
        style={{
          padding: '16px 18px 12px',
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
          {title}
        </Text>
        {count != null ? (
          <Text
            style={{
              ...styles.tnum,
              fontSize: 13,
              fontWeight: 600,
              color: countColor,
              whiteSpace: 'nowrap',
            }}
          >
            {count}
          </Text>
        ) : null}
      </View>
      <View style={{ height: 1, backgroundColor: theme.tableBorder }} />
      {children}
    </View>
  );
}

const railItemTitle = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '-0.014em',
  color: theme.pageText,
};

const railItemNote = {
  fontSize: 13,
  fontWeight: 500,
  color: theme.pageTextLight,
  lineHeight: 1.45,
};

const railAction = {
  alignSelf: 'flex-start',
  height: 32,
  padding: '0 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 650,
  whiteSpace: 'nowrap',
};

function RailEmpty({ children }: { children: ReactNode }) {
  return (
    <Text style={{ ...railItemNote, padding: '14px 18px' }}>{children}</Text>
  );
}

type Decision =
  | {
      kind: 'overspent';
      category: CategoryEntity;
      balance: number;
      spent: number;
    }
  | {
      kind: 'underfunded';
      category: CategoryEntity;
      short: number;
      goal: number;
    };

function OverspentItem({
  month,
  item,
  isLast,
}: {
  month: string;
  item: Extract<Decision, { kind: 'overspent' }>;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const { onBudgetAction } = useEnvelopeBudget();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { category, balance, spent } = item;
  const nextMonth = monthUtils.format(
    monthUtils.nextMonth(month),
    'MMMM',
    locale,
  );

  return (
    <RailItem isLast={isLast}>
      <PrivacyFilter>
        <Text style={railItemTitle}>
          {t('{{name}} is {{amount}} over', {
            name: category.name,
            amount: format(-balance, 'financial'),
          })}
        </Text>
        <Text style={railItemNote}>
          {t('Spent {{spent}} against {{had}} in the envelope.', {
            spent: format(spent, 'financial'),
            had: format(Math.max(0, balance + spent), 'financial'),
          })}
        </Text>
        {/* Overspending never disappears: left alone it quietly comes off the
            next month's money, which is the part nobody sees happening. */}
        <Text style={railItemNote}>
          {t('Left uncovered, it comes out of {{month}} instead.', {
            month: nextMonth,
          })}
        </Text>
      </PrivacyFilter>
      <View ref={ref} style={{ alignSelf: 'flex-start' }}>
        <Button
          variant="primary"
          onPress={() => setOpen(true)}
          style={railAction}
        >
          <Trans>Cover overspending</Trans>
        </Button>
      </View>
      <Popover
        triggerRef={ref}
        placement="bottom start"
        isOpen={open}
        onOpenChange={() => setOpen(false)}
        style={{ width: 240, margin: 1 }}
        isNonModal
      >
        <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
          <CoverMenu
            categoryId={category.id}
            initialAmount={balance}
            onClose={() => setOpen(false)}
            onSubmit={(amount, fromCategoryId) => {
              onBudgetAction(month, 'cover-overspending', {
                to: category.id,
                from: fromCategoryId,
                amount,
                currencyCode: format.currency.code,
              });
            }}
          />
        </SheetNameProvider>
      </Popover>
    </RailItem>
  );
}

function UnderfundedItem({
  month,
  item,
  isLast,
}: {
  month: string;
  item: Extract<Decision, { kind: 'underfunded' }>;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const { onBudgetAction } = useEnvelopeBudget();
  const { category, short, goal } = item;

  return (
    <RailItem isLast={isLast}>
      <PrivacyFilter>
        <Text style={railItemTitle}>
          {t('{{name}} is short {{amount}}', {
            name: category.name,
            amount: format(short, 'financial'),
          })}
        </Text>
        <Text style={railItemNote}>
          {t('Its template asks for {{goal}} this month.', {
            goal: format(goal, 'financial'),
          })}
        </Text>
      </PrivacyFilter>
      <Button
        variant="primary"
        style={railAction}
        onPress={() =>
          onBudgetAction(month, 'apply-single-category-template', {
            category: category.id,
          })
        }
      >
        <Trans>Apply template</Trans>
      </Button>
    </RailItem>
  );
}

function RailItem({
  isLast,
  children,
}: {
  isLast: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        padding: '14px 18px',
        gap: 8,
        ...(!isLast && { borderBottom: `1px solid ${theme.tableBorder}` }),
      }}
    >
      {children}
    </View>
  );
}

const MAX_DECISIONS = 6;

/**
 * Envelopes that are overspent this month, and — when templates are on — the
 * ones whose template is not yet met. Each offers the existing action for it.
 */
function NeedsDecisionCard({ month }: { month: string }) {
  const { t } = useTranslation();
  const templatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const { data: { grouped = [] } = {} } = useCategories();

  const categories = useMemo(
    () =>
      grouped
        .filter(g => !g.is_income && !g.hidden)
        .flatMap(g => (g.categories ?? []).filter(c => !c.hidden)),
    [grouped],
  );
  const names = useMemo(
    () =>
      categories.flatMap(c => [
        cell(month, `leftover-${c.id}`),
        cell(month, `sum-amount-${c.id}`),
        ...(templatesEnabled
          ? [
              cell(month, `budget-${c.id}`),
              cell(month, `goal-${c.id}`),
              cell(month, `long-goal-${c.id}`),
            ]
          : []),
      ]),
    [categories, month, templatesEnabled],
  );
  const cells = useCells(names);

  const decisions: Decision[] = [];
  for (const category of categories) {
    const balance = cells[cell(month, `leftover-${category.id}`)];
    const spent = -(cells[cell(month, `sum-amount-${category.id}`)] ?? 0);
    if (balance != null && balance < 0) {
      decisions.push({ kind: 'overspent', category, balance, spent });
      continue;
    }
    if (!templatesEnabled) continue;
    const goal = cells[cell(month, `goal-${category.id}`)];
    if (goal == null) continue;
    const budgeted = cells[cell(month, `budget-${category.id}`)] ?? 0;
    const longGoal = cells[cell(month, `long-goal-${category.id}`)];
    const diff = longGoal === 1 ? (balance ?? 0) - goal : budgeted - goal;
    if (diff < 0) {
      decisions.push({ kind: 'underfunded', category, short: -diff, goal });
    }
  }

  const shown = decisions.slice(0, MAX_DECISIONS);
  const hidden = decisions.length - shown.length;

  return (
    <RailCard
      title={<Trans>Needs a decision</Trans>}
      count={decisions.length > 0 ? decisions.length : undefined}
      countColor={theme.errorText}
    >
      {shown.length === 0 ? (
        <RailEmpty>
          <Trans>No envelope is overspent.</Trans>
        </RailEmpty>
      ) : (
        shown.map((item, i) =>
          item.kind === 'overspent' ? (
            <OverspentItem
              key={item.category.id}
              month={month}
              item={item}
              isLast={i === shown.length - 1 && hidden === 0}
            />
          ) : (
            <UnderfundedItem
              key={item.category.id}
              month={month}
              item={item}
              isLast={i === shown.length - 1 && hidden === 0}
            />
          ),
        )
      )}
      {hidden > 0 ? (
        <RailEmpty>{t('and {{count}} more', { count: hidden })}</RailEmpty>
      ) : null}
    </RailCard>
  );
}

const MAX_DUE = 8;

/**
 * What is scheduled to leave before the next scheduled income lands. With no
 * income schedule to measure against, the window is the rest of the month.
 */
function DueBeforePaydayCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const dispatch = useDispatch();
  const { data: payees = {} } = usePayeesById();
  const query = useMemo(
    () =>
      q('schedules')
        .filter({ completed: false })
        .select('*')
        .orderBy({ next_date: 'asc' }),
    [],
  );
  const { schedules, statuses, isLoading } = useSchedules({ query });

  const today = monthUtils.currentDay();
  const open = schedules.filter(s => {
    const status = statuses.get(s.id);
    return s.next_date && status !== 'paid' && status !== 'completed';
  });
  const payday = open.find(
    s => s.next_date >= today && getScheduledAmount(s._amount) > 0,
  );
  const until = payday ? payday.next_date : monthUtils.getMonthEnd(today);
  const due = open.filter(s => s.next_date <= until).slice(0, MAX_DUE);
  const days = Math.max(0, monthUtils.differenceInCalendarDays(until, today));

  const nameOf = (s: ScheduleEntity) =>
    s.name || (s._payee && payees[s._payee]?.name) || t('Unnamed schedule');

  return (
    <RailCard
      title={
        payday ? (
          <Trans>Due before payday</Trans>
        ) : (
          <Trans>Due this month</Trans>
        )
      }
      count={isLoading ? undefined : t('{{count}} days', { count: days })}
    >
      {!isLoading && due.length === 0 ? (
        <RailEmpty>
          <Trans>Nothing scheduled.</Trans>
        </RailEmpty>
      ) : (
        due.map((s, i) => {
          const status = statuses.get(s.id);
          const overdue = status === 'missed';
          return (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                dispatch(
                  pushModal({
                    modal: { name: 'schedule-edit', options: { id: s.id } },
                  }),
                )
              }
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                width: '100%',
                padding: '12px 18px',
                border: 0,
                borderBottom:
                  i === due.length - 1 ? 0 : `1px solid ${theme.tableBorder}`,
                background: 'transparent',
                font: 'inherit',
                color: theme.pageText,
                textAlign: 'left',
                cursor: 'pointer',
                ':hover': { backgroundColor: theme.tableRowBackgroundHover },
                ':focus-visible': {
                  outline: `2px solid ${theme.formInputBorderSelected}`,
                  outlineOffset: -2,
                },
              })}
            >
              <View style={{ gap: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    letterSpacing: '-0.014em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {nameOf(s)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    color: overdue ? theme.errorText : theme.pageTextSubdued,
                  }}
                >
                  {overdue
                    ? t('Missed · {{date}}', {
                        date: monthUtils.format(
                          s.next_date,
                          'EEEE d MMM',
                          locale,
                        ),
                      })
                    : monthUtils.format(s.next_date, 'EEEE d MMM', locale)}
                </Text>
              </View>
              <PrivacyFilter>
                <Text
                  style={{
                    ...styles.tnum,
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.018em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {format(getScheduledAmount(s._amount), 'financial')}
                </Text>
              </PrivacyFilter>
            </button>
          );
        })
      )}
    </RailCard>
  );
}

// ── Bank against budget ──────────────────────────────────────────────────────

/** How many of the transactions behind a gap are worth naming in the card. */
const MAX_LEAKS = 4;

/**
 * The one identity envelope budgeting rests on, and the only place the app
 * states it: what the envelopes, the unassigned money and anything held back
 * add up to has to equal what the on-budget accounts actually hold.
 *
 * Whenever they disagree the budget is claiming money the bank does not have.
 * Moving cash to an account the budget does not track is the common way in:
 * the checking balance drops, the envelope that was meant to cover it stays
 * full, and the household reads the same money twice — once as savings, once
 * as budget. Every cent of the difference is a transaction no category saw, so
 * the card names them rather than leaving a mystery figure.
 */
function BankAgainstBudgetCard({ month }: { month: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const { data: onBudgetAccounts = [] } = useOnBudgetAccounts();
  const { data: { grouped = [] } = {} } = useCategories();

  // The sheet only knows transactions dated up to the end of this month, so
  // the bank side is cut off at the same day or the two can never agree.
  const through = monthUtils.lastDayOfMonth(monthUtils.firstDayOfMonth(month));

  // Matches the `sum-amount-<category>` cells exactly: on-budget accounts,
  // leaf transactions, no filter on closed — closing an account in Actual
  // moves its balance out, so it contributes nothing, and leaving it in keeps
  // the identity exact rather than nearly right.
  const { data: bank } = useQuery<number>(
    () =>
      q('transactions')
        .filter({
          'account.offbudget': false,
          is_parent: false,
          date: { $lte: through },
        })
        .calculate({ $sum: '$amount' }),
    [through],
  );

  // Upstream's own definition of money the budget never saw: on an on-budget
  // account, no category, and either not a transfer at all or a transfer to an
  // account the budget does not track. A move between two on-budget accounts
  // has both legs inside the total, so it nets to zero and is rightly absent.
  const { data: uncategorised } = useQuery<LeakRow>(
    () =>
      uncategorizedTransactions()
        .filter({ is_parent: false, date: { $lte: through } })
        .select([
          'id',
          'date',
          'amount',
          { payeeName: 'payee.name' },
          { accountName: 'account.name' },
          { transferAccount: 'payee.transfer_acct' },
        ])
        .orderBy({ date: 'desc' }),
    [through],
  );

  const expenseCategories = useMemo(
    () => grouped.filter(g => !g.is_income).flatMap(g => g.categories ?? []),
    [grouped],
  );
  const names = useMemo(
    () => [
      cell(month, 'to-budget'),
      cell(month, 'buffered-selected'),
      ...expenseCategories.map(c => cell(month, `leftover-${c.id}`)),
    ],
    [month, expenseCategories],
  );
  const cells = useCells(names);

  // An unloaded cell is not a zero: reconciling against a half-bound sheet
  // would invent a gap and send someone hunting for a transaction that is fine.
  const ready =
    bank != null &&
    uncategorised != null &&
    names.every(name => cells[name] !== undefined);

  const onBudgetIds = useMemo(
    () => new Set(onBudgetAccounts.map(a => a.id)),
    [onBudgetAccounts],
  );

  const result = useMemo(() => {
    if (!ready) return null;
    return reconcile({
      inTheBank: bank?.[0] ?? 0,
      envelopeBalances: expenseCategories.map(
        c => cells[cell(month, `leftover-${c.id}`)] ?? 0,
      ),
      toBudget: cells[cell(month, 'to-budget')] ?? 0,
      buffered: cells[cell(month, 'buffered-selected')] ?? 0,
      leaks: findLeaks(uncategorised ?? [], onBudgetIds),
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- cells is rebuilt per bound cell
  }, [
    ready,
    bank,
    uncategorised,
    onBudgetIds,
    expenseCategories,
    cells,
    month,
  ]);

  const money = (cents: number) => format(cents, 'financial');

  if (!result) {
    return (
      <RailCard title={<Trans>Bank against budget</Trans>}>
        <RailEmpty>
          <Trans>Checking…</Trans>
        </RailEmpty>
      </RailCard>
    );
  }

  const { gap, inTheBank, inTheBudget, leaks, explained } = result;
  const shown = leaks.slice(0, MAX_LEAKS);
  const hidden = leaks.length - shown.length;

  if (gap === 0) {
    return (
      <RailCard
        title={<Trans>Bank against budget</Trans>}
        count={<PrivacyFilter>{money(inTheBank)}</PrivacyFilter>}
        countColor={theme.noticeText}
      >
        <RailEmpty>
          <Trans>
            The envelopes, the unassigned money and the accounts agree to the
            cent. Nothing is being counted twice.
          </Trans>
        </RailEmpty>
      </RailCard>
    );
  }

  return (
    <RailCard
      title={<Trans>Bank against budget</Trans>}
      count={<PrivacyFilter>{money(gap)}</PrivacyFilter>}
      countColor={theme.errorText}
    >
      <RailItem isLast={shown.length === 0 && hidden === 0}>
        <PrivacyFilter>
          <Text style={railItemTitle}>
            {gap < 0
              ? t('The budget claims {{amount}} the accounts do not hold', {
                  amount: money(-gap),
                })
              : t('The accounts hold {{amount}} no envelope has claimed', {
                  amount: money(gap),
                })}
          </Text>
          <Text style={railItemNote}>
            {t(
              '{{bank}} in the accounts against {{budget}} across the envelopes, unassigned and held back.',
              {
                bank: money(inTheBank),
                budget: money(inTheBudget),
              },
            )}
          </Text>
          {!explained ? (
            <Text style={railItemNote}>
              <Trans>
                Part of this is older than the transactions below — check for
                split transactions whose parts are not all categorised.
              </Trans>
            </Text>
          ) : null}
        </PrivacyFilter>
      </RailItem>
      {shown.map((leak, i) => (
        <RailItem key={leak.id} isLast={i === shown.length - 1 && hidden === 0}>
          <PrivacyFilter>
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
                  ...railItemTitle,
                  fontWeight: 500,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {leak.payeeName || t('No payee')}
              </Text>
              <Text
                style={{
                  ...styles.tnum,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.018em',
                  whiteSpace: 'nowrap',
                }}
              >
                {money(leak.amount)}
              </Text>
            </View>
            <Text style={railItemNote}>
              {leak.kind === 'off-budget-transfer'
                ? t(
                    '{{date}} · moved out of the budget, so no envelope paid for it',
                    {
                      date: monthUtils.format(leak.date, 'd MMM', locale),
                    },
                  )
                : t(
                    '{{date}} · {{account}} · no category, so no envelope paid for it',
                    {
                      date: monthUtils.format(leak.date, 'd MMM', locale),
                      account: leak.accountName,
                    },
                  )}
            </Text>
          </PrivacyFilter>
        </RailItem>
      ))}
      {hidden > 0 ? (
        <RailEmpty>{t('and {{count}} more', { count: hidden })}</RailEmpty>
      ) : null}
    </RailCard>
  );
}

/**
 * The column beside the envelopes. Where the window is too narrow for a column,
 * `inline` sets the two cards side by side under the month's bar instead.
 */
export function BudgetRail({
  month,
  inline = false,
}: {
  month: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 16,
          marginTop: 16,
        }}
      >
        <View style={{ flex: '1 1 300px', minWidth: 0 }}>
          <NeedsDecisionCard month={month} />
        </View>
        <View style={{ flex: '1 1 300px', minWidth: 0 }}>
          <DueBeforePaydayCard />
        </View>
        <View style={{ flex: '1 1 300px', minWidth: 0 }}>
          <BankAgainstBudgetCard month={month} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 16 }}>
      <NeedsDecisionCard month={month} />
      <DueBeforePaydayCard />
      <BankAgainstBudgetCard month={month} />
    </View>
  );
}
