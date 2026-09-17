import React, { memo, useRef, useState } from 'react';
import type { ComponentProps, CSSProperties, MouseEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCheveronDown } from '@actual-app/components/icons/v1';
import {
  SvgArrowsSynchronize,
  SvgCalendar3,
} from '@actual-app/components/icons/v2';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { css } from '@emotion/css';

import { BalanceWithCarryover } from '#components/budget/BalanceWithCarryover';
import { useIsInstrumentMonth } from '#components/budget/MonthsContext';
import { makeAmountGrey } from '#components/budget/util';
import {
  EnvelopeChip,
  EnvelopeMeter,
  SpendHistory,
  useEnvelopeState,
} from '#components/custom/EnvelopeRowParts';
import { columnLabel } from '#components/custom/primitives';
import { NotesButton } from '#components/NotesButton';
import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { Field, Row, SheetCell } from '#components/table';
import type { SheetCellProps } from '#components/table';
import { useCategoryScheduleGoalTemplateIndicator } from '#hooks/useCategoryScheduleGoalTemplateIndicator';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useSheetName } from '#hooks/useSheetName';
import { useSheetValue } from '#hooks/useSheetValue';
import { useUndo } from '#hooks/useUndo';
import type { Binding, SheetFields } from '#spreadsheet';
import { envelopeBudget } from '#spreadsheet/bindings';
import type { CategoryGroupMonthProps, CategoryMonthProps } from '..';

import { BalanceMovementMenu } from './BalanceMovementMenu';
import { BudgetMenu } from './BudgetMenu';
import { IncomeMenu } from './IncomeMenu';

export function useEnvelopeSheetName<
  FieldName extends SheetFields<'envelope-budget'>,
>(binding: Binding<'envelope-budget', FieldName>) {
  return useSheetName(binding);
}

export function useEnvelopeSheetValue<
  FieldName extends SheetFields<'envelope-budget'>,
>(binding: Binding<'envelope-budget', FieldName>) {
  return useSheetValue(binding);
}

export const EnvelopeCellValue = <
  FieldName extends SheetFields<'envelope-budget'>,
>(
  props: ComponentProps<typeof CellValue<'envelope-budget', FieldName>>,
) => {
  return <CellValue {...props} />;
};

const EnvelopeSheetCell = <FieldName extends SheetFields<'envelope-budget'>>(
  props: SheetCellProps<'envelope-budget', FieldName>,
) => {
  return <SheetCell {...props} />;
};

const headerLabelStyle: CSSProperties = {
  flex: 1,
  padding: '0 5px',
  textAlign: 'right',
};

// The instrument's columns, right of the history line and the bar. The budget
// column holds the notes and menu controls beside the editable figure.
const INSTRUMENT_HISTORY_WIDTH = 80;
const INSTRUMENT_BUDGET_WIDTH = 164;
const INSTRUMENT_FIGURE_WIDTH = 108;
const INSTRUMENT_STATUS_WIDTH = 112;

const instrumentSpent: CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  color: theme.pageTextLight,
};

const instrumentBalance: CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

const cellStyle: CSSProperties = {
  color: theme.tableHeaderText,
  fontWeight: 600,
};

export const BudgetTotalsMonth = memo(function BudgetTotalsMonth() {
  const isInstrument = useIsInstrumentMonth();
  if (isInstrument) {
    // One month: the bar above already reads out the totals, so the header
    // names the columns and nothing else.
    const label: CSSProperties = { ...columnLabel, whiteSpace: 'nowrap' };
    return (
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 10,
          paddingBottom: 9,
          backgroundColor: theme.budgetCurrentMonth,
        }}
      >
        <Text
          style={{
            ...label,
            width: INSTRUMENT_HISTORY_WIDTH,
            textAlign: 'center',
          }}
        >
          <Trans>6 mo</Trans>
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            ...label,
            width: INSTRUMENT_BUDGET_WIDTH,
            textAlign: 'right',
            paddingRight: 9,
          }}
        >
          <Trans>Budgeted</Trans>
        </Text>
        <Text
          style={{
            ...label,
            width: INSTRUMENT_FIGURE_WIDTH,
            textAlign: 'right',
            paddingRight: 5,
          }}
        >
          <Trans>Spent</Trans>
        </Text>
        <Text
          style={{
            ...label,
            width: INSTRUMENT_FIGURE_WIDTH,
            textAlign: 'right',
            paddingRight: 5,
          }}
        >
          <Trans>Balance</Trans>
        </Text>
        <View style={{ width: INSTRUMENT_STATUS_WIDTH }} />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        marginRight: styles.monthRightPadding,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: theme.budgetCurrentMonth,
      }}
    >
      <View style={headerLabelStyle}>
        <Text style={{ color: theme.tableHeaderText }}>
          <Trans>Budgeted</Trans>
        </Text>
        <EnvelopeCellValue
          binding={envelopeBudget.totalBudgeted}
          type="financial"
        >
          {props => (
            <CellValueText {...props} value={-props.value} style={cellStyle} />
          )}
        </EnvelopeCellValue>
      </View>
      <View style={headerLabelStyle}>
        <Text style={{ color: theme.tableHeaderText }}>
          <Trans>Spent</Trans>
        </Text>
        <EnvelopeCellValue binding={envelopeBudget.totalSpent} type="financial">
          {props => <CellValueText {...props} style={cellStyle} />}
        </EnvelopeCellValue>
      </View>
      <View style={headerLabelStyle}>
        <Text style={{ color: theme.tableHeaderText }}>
          <Trans>Balance</Trans>
        </Text>
        <EnvelopeCellValue
          binding={envelopeBudget.totalBalance}
          type="financial"
        >
          {props => <CellValueText {...props} style={cellStyle} />}
        </EnvelopeCellValue>
      </View>
    </View>
  );
});

export function IncomeHeaderMonth() {
  return (
    <Row
      style={{
        color: theme.tableHeaderText,
        alignItems: 'center',
        paddingRight: 10,
        backgroundColor: theme.budgetCurrentMonth,
      }}
    >
      <View style={{ flex: 1, textAlign: 'right' }}>
        <Trans>Received</Trans>
      </View>
    </Row>
  );
}

export const ExpenseGroupMonth = memo(function ExpenseGroupMonth({
  month,
  group,
}: CategoryGroupMonthProps) {
  const { id } = group;
  const isInstrument = useIsInstrumentMonth();
  const budgeted = useEnvelopeSheetValue(envelopeBudget.groupBudgeted(id));
  const spent = useEnvelopeSheetValue(envelopeBudget.groupSumAmount(id));
  const balance = useEnvelopeSheetValue(envelopeBudget.groupBalance(id));
  const state = useEnvelopeState(budgeted, spent, balance);

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: monthUtils.isCurrentMonth(month)
          ? theme.budgetHeaderCurrentMonth
          : theme.budgetHeaderOtherMonth,
      }}
    >
      {isInstrument && (
        <>
          <InstrumentHistoryField month={month} id={id} isGroup />
          <InstrumentMeterField percent={state.pct} color={state.fill} />
        </>
      )}
      <EnvelopeSheetCell
        name="budgeted"
        width={isInstrument ? INSTRUMENT_BUDGET_WIDTH : 'flex'}
        textAlign="right"
        style={{
          fontWeight: 600,
          ...styles.tnum,
          ...(isInstrument && {
            fontSize: 15,
            fontWeight: 650,
            letterSpacing: '-0.014em',
            paddingRight: 9,
          }),
        }}
        valueProps={{
          binding: envelopeBudget.groupBudgeted(id),
          type: 'financial',
        }}
      />
      <EnvelopeSheetCell
        name="spent"
        width={isInstrument ? INSTRUMENT_FIGURE_WIDTH : 'flex'}
        textAlign="right"
        style={{
          fontWeight: 600,
          ...styles.tnum,
          ...(isInstrument && instrumentSpent),
        }}
        valueProps={{
          binding: envelopeBudget.groupSumAmount(id),
          type: 'financial',
        }}
      />
      <EnvelopeSheetCell
        name="balance"
        width={isInstrument ? INSTRUMENT_FIGURE_WIDTH : 'flex'}
        textAlign="right"
        style={{
          fontWeight: 600,
          paddingRight: isInstrument ? 0 : styles.monthRightPadding,
          ...styles.tnum,
          ...(isInstrument && instrumentBalance),
        }}
        valueProps={{
          binding: envelopeBudget.groupBalance(id),
          type: 'financial',
        }}
      />
      {isInstrument && (
        <InstrumentStatusField tone={state.tone}>
          {state.label}
        </InstrumentStatusField>
      )}
    </View>
  );
});

export const ExpenseCategoryMonth = memo(function ExpenseCategoryMonth({
  month,
  category,
  editing,
  onEdit,
  onBudgetAction,
  onShowActivity,
}: CategoryMonthProps) {
  const { t } = useTranslation();
  const format = useFormat();

  const budgetMenuTriggerRef = useRef(null);
  const balanceMenuTriggerRef = useRef(null);
  const [budgetMenuOpen, setBudgetMenuOpen] = useState(false);
  const [budgetPosition, setBudgetPosition] = useState({
    crossOffset: 0,
    offset: 0,
  });
  const resetBudgetPosition = (crossOffset = 0, offset = 0) =>
    setBudgetPosition({ crossOffset, offset });

  const handleBudgetContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setBudgetPosition({
      crossOffset: e.clientX - rect.left,
      offset: e.clientY - rect.bottom,
    });
    setBudgetMenuOpen(true);
  };

  const [balanceMenuOpen, setBalanceMenuOpen] = useState(false);
  const [balancePosition, setBalancePosition] = useState({
    crossOffset: 0,
    offset: 0,
  });
  const resetBalancePosition = (crossOffset = 0, offset = 0) =>
    setBalancePosition({ crossOffset, offset });

  const handleBalanceContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setBalancePosition({
      crossOffset: e.clientX - rect.left,
      offset: e.clientY - rect.bottom,
    });
    setBalanceMenuOpen(true);
  };

  const onMenuAction = (...args: Parameters<typeof onBudgetAction>) => {
    onBudgetAction(...args);
    setBudgetMenuOpen(false);
  };

  const { showUndoNotification } = useUndo();

  const navigate = useNavigate();

  const { schedule, scheduleStatus, isScheduleRecurring, description } =
    useCategoryScheduleGoalTemplateIndicator({
      category,
      month,
    });

  const showScheduleIndicator = schedule && scheduleStatus;

  const isInstrument = useIsInstrumentMonth();
  const budgetedValue = useEnvelopeSheetValue(
    envelopeBudget.catBudgeted(category.id),
  );
  const spentValue = useEnvelopeSheetValue(
    envelopeBudget.catSumAmount(category.id),
  );
  const balanceValue = useEnvelopeSheetValue(
    envelopeBudget.catBalance(category.id),
  );
  const state = useEnvelopeState(budgetedValue, spentValue, balanceValue);

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: monthUtils.isCurrentMonth(month)
          ? theme.budgetCurrentMonth
          : theme.budgetOtherMonth,
        '& .hover-visible': {
          opacity: 0,
          transition: 'opacity .25s',
        },
        '&:hover .hover-visible, & .force-visible .hover-visible': {
          opacity: 1,
        },
        '& .hover-expand': {
          maxWidth: 0,
          overflow: 'hidden',
          transition: 'max-width 0s .25s',
        },
        '&:hover .hover-expand, & .hover-expand.force-visible': {
          maxWidth: '300px',
          overflow: 'visible',
          transition: 'max-width 0s linear 0s',
        },
      }}
    >
      {isInstrument && (
        <>
          <InstrumentHistoryField month={month} id={category.id} />
          <InstrumentMeterField percent={state.pct} color={state.fill} />
        </>
      )}
      <View
        ref={budgetMenuTriggerRef}
        style={{
          ...(isInstrument
            ? { width: INSTRUMENT_BUDGET_WIDTH, flexShrink: 0 }
            : { flex: 1 }),
          flexDirection: 'row',
        }}
        onContextMenu={e => {
          if (editing) return;
          handleBudgetContextMenu(e);
        }}
      >
        {!editing && (
          <>
            <View
              style={{
                paddingLeft: 3,
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: theme.tableBorder,
              }}
            >
              <NotesButton
                id={`${category.id}-${month}`}
                defaultColor={theme.pageTextLight}
              />
            </View>
            <View
              className={`hover-expand ${budgetMenuOpen ? 'force-visible' : ''}`}
              style={{
                flexDirection: 'row',
                flexShrink: 1,
                paddingLeft: 3,
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: theme.tableBorder,
              }}
            >
              <Button
                variant="bare"
                onPress={() => {
                  resetBudgetPosition(2, -4);
                  setBudgetMenuOpen(true);
                }}
                style={{
                  padding: 3,
                }}
              >
                <SvgCheveronDown
                  width={14}
                  height={14}
                  className="hover-visible"
                />
              </Button>
              <Popover
                triggerRef={budgetMenuTriggerRef}
                placement="bottom left"
                isOpen={budgetMenuOpen}
                onOpenChange={() => setBudgetMenuOpen(false)}
                style={{ width: 200 }}
                isNonModal
                {...budgetPosition}
              >
                <BudgetMenu
                  onCopyLastMonthAverage={() => {
                    onMenuAction(month, 'copy-single-last', {
                      category: category.id,
                    });
                    showUndoNotification({
                      message: t(`Budget set to last month's budget.`),
                    });
                  }}
                  onSetMonthsAverage={numberOfMonths => {
                    if (
                      numberOfMonths !== 3 &&
                      numberOfMonths !== 6 &&
                      numberOfMonths !== 12
                    ) {
                      return;
                    }

                    onMenuAction(month, `set-single-${numberOfMonths}-avg`, {
                      category: category.id,
                    });
                    showUndoNotification({
                      message: t(
                        'Budget set to {{numberOfMonths}}-month average.',
                        { numberOfMonths },
                      ),
                    });
                  }}
                  onApplyBudgetTemplate={() => {
                    onMenuAction(month, 'apply-single-category-template', {
                      category: category.id,
                    });
                    showUndoNotification({
                      message: t(`Budget template applied.`),
                    });
                  }}
                />
              </Popover>
            </View>
          </>
        )}
        <EnvelopeSheetCell
          name="budget"
          exposed={editing}
          focused={editing}
          width="flex"
          onExpose={() => onEdit(category.id, month)}
          style={{
            ...(editing && { zIndex: 100 }),
            ...styles.tnum,
            ...(isInstrument && {
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.014em',
            }),
          }}
          textAlign="right"
          valueStyle={{
            cursor: 'default',
            margin: 1,
            padding: '0 4px',
            borderRadius: 4,
            ':hover': {
              boxShadow: 'inset 0 0 0 1px ' + theme.pageTextSubdued, //remove mobile color variable
              backgroundColor: theme.budgetCurrentMonth,
            },
          }}
          valueProps={{
            binding: envelopeBudget.catBudgeted(category.id),
            type: 'financial',
            getValueStyle: makeAmountGrey,
            formatExpr: format.forEdit,
            unformatExpr: format.fromEdit,
          }}
          inputProps={{
            onBlur: () => {
              onEdit(null);
            },
            style: {
              backgroundColor: theme.budgetCurrentMonth,
            },
          }}
          onSave={(parsedIntegerAmount: number | null) => {
            onBudgetAction(month, 'budget-amount', {
              category: category.id,
              amount: parsedIntegerAmount ?? 0,
            });
          }}
        />
      </View>
      <Field
        name="spent"
        width={isInstrument ? INSTRUMENT_FIGURE_WIDTH : 'flex'}
        style={{
          textAlign: 'right',
          ...(isInstrument && instrumentSpent),
        }}
      >
        <View
          data-testid="category-month-spent"
          onClick={() => onShowActivity(category.id, month)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: showScheduleIndicator
              ? 'space-between'
              : 'flex-end',
            gap: 2,
          }}
        >
          {showScheduleIndicator && (
            <View title={description}>
              <Button
                variant="bare"
                style={{
                  color:
                    scheduleStatus === 'missed'
                      ? theme.budgetNumberNegative
                      : scheduleStatus === 'due'
                        ? theme.templateNumberUnderFunded
                        : theme.upcomingText,
                }}
                onPress={() =>
                  schedule._account
                    ? navigate(`/accounts/${schedule._account}`)
                    : navigate('/accounts')
                }
              >
                {isScheduleRecurring ? (
                  <SvgArrowsSynchronize style={{ width: 12, height: 12 }} />
                ) : (
                  <SvgCalendar3 style={{ width: 12, height: 12 }} />
                )}
              </Button>
            </View>
          )}
          <EnvelopeCellValue
            binding={envelopeBudget.catSumAmount(category.id)}
            type="financial"
          >
            {props => (
              <CellValueText
                {...props}
                className={css({
                  cursor: 'pointer',
                  ':hover': { textDecoration: 'underline' },
                  ...makeAmountGrey(props.value),
                })}
              />
            )}
          </EnvelopeCellValue>
        </View>
      </Field>
      <Field
        ref={balanceMenuTriggerRef}
        name="balance"
        width={isInstrument ? INSTRUMENT_FIGURE_WIDTH : 'flex'}
        style={{
          paddingRight: isInstrument ? 0 : styles.monthRightPadding,
          textAlign: 'right',
          ...(isInstrument && instrumentBalance),
        }}
      >
        <Button
          variant="bare"
          onPress={() => {
            resetBalancePosition(-6, -4);
            setBalanceMenuOpen(true);
          }}
          onContextMenu={e => {
            handleBalanceContextMenu(e);
            // We need to calculate differently from the hook due to being aligned to the right
            const rect = e.currentTarget.getBoundingClientRect();
            resetBalancePosition(
              e.clientX - rect.right + 200 - 8,
              e.clientY - rect.bottom - 8,
            );
          }}
          style={{
            justifyContent: 'flex-end',
            background: 'transparent',
            width: '100%',
            padding: 0,
          }}
        >
          <BalanceWithCarryover
            carryover={envelopeBudget.catCarryover(category.id)}
            balance={envelopeBudget.catBalance(category.id)}
            goal={envelopeBudget.catGoal(category.id)}
            budgeted={envelopeBudget.catBudgeted(category.id)}
            longGoal={envelopeBudget.catLongGoal(category.id)}
            tooltipDisabled={balanceMenuOpen}
          />
        </Button>

        <Popover
          triggerRef={balanceMenuTriggerRef}
          placement="bottom end"
          isOpen={balanceMenuOpen}
          onOpenChange={() => setBalanceMenuOpen(false)}
          style={{
            margin: 1,
            minWidth: 190,
          }}
          isNonModal
          {...balancePosition}
        >
          <BalanceMovementMenu
            categoryId={category.id}
            month={month}
            onBudgetAction={onBudgetAction}
            onClose={() => setBalanceMenuOpen(false)}
          />
        </Popover>
      </Field>
      {isInstrument && (
        <InstrumentStatusField tone={state.tone}>
          {state.label}
        </InstrumentStatusField>
      )}
    </View>
  );
});

function InstrumentHistoryField({
  month,
  id,
  isGroup = false,
}: {
  month: string;
  id: string;
  isGroup?: boolean;
}) {
  return (
    <Field
      name="history"
      width={INSTRUMENT_HISTORY_WIDTH}
      truncate={false}
      contentStyle={{ alignItems: 'center' }}
    >
      <SpendHistory month={month} id={id} isGroup={isGroup} />
    </Field>
  );
}

function InstrumentMeterField({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  return (
    <Field
      name="progress"
      width="flex"
      truncate={false}
      contentStyle={{ padding: '0 14px' }}
    >
      <EnvelopeMeter percent={percent} color={color} />
    </Field>
  );
}

function InstrumentStatusField({
  tone,
  children,
}: {
  tone: ComponentProps<typeof EnvelopeChip>['tone'];
  children: string;
}) {
  return (
    <Field
      name="status"
      width={INSTRUMENT_STATUS_WIDTH}
      truncate={false}
      style={{ paddingRight: styles.monthRightPadding }}
      contentStyle={{ alignItems: 'flex-end' }}
    >
      <EnvelopeChip tone={tone}>{children}</EnvelopeChip>
    </Field>
  );
}

type IncomeGroupMonthProps = {
  month: string;
};
export function IncomeGroupMonth({ month }: IncomeGroupMonthProps) {
  return (
    <View style={{ flex: 1 }}>
      <EnvelopeSheetCell
        name="received"
        width="flex"
        textAlign="right"
        style={{
          fontWeight: 600,
          paddingRight: styles.monthRightPadding,
          ...styles.tnum,
          backgroundColor: monthUtils.isCurrentMonth(month)
            ? theme.budgetHeaderCurrentMonth
            : theme.budgetHeaderOtherMonth,
        }}
        valueProps={{
          binding: envelopeBudget.groupIncomeReceived,
          type: 'financial',
        }}
      />
    </View>
  );
}

export function IncomeCategoryMonth({
  category,
  isLast,
  month,
  onShowActivity,
  onBudgetAction,
}: CategoryMonthProps) {
  const incomeMenuTriggerRef = useRef(null);
  const [incomeMenuOpen, setIncomeMenuOpen] = useState(false);
  const [incomePosition, setIncomePosition] = useState({
    crossOffset: 0,
    offset: 0,
  });
  const resetIncomePosition = (crossOffset = 0, offset = 0) =>
    setIncomePosition({ crossOffset, offset });

  const handleIncomeContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setIncomePosition({
      crossOffset: e.clientX - rect.left,
      offset: e.clientY - rect.bottom,
    });
    setIncomeMenuOpen(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <Field
        name="received"
        width="flex"
        truncate={false}
        ref={incomeMenuTriggerRef}
        style={{
          textAlign: 'right',
          ...(isLast && { borderBottomWidth: 0 }),
          backgroundColor: monthUtils.isCurrentMonth(month)
            ? theme.budgetCurrentMonth
            : theme.budgetOtherMonth,
        }}
      >
        <View
          name="received"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            position: 'relative',
          }}
        >
          <Button
            variant="bare"
            onPress={() => {
              resetIncomePosition(-6, -4);
              setIncomeMenuOpen(true);
            }}
            onContextMenu={e => {
              handleIncomeContextMenu(e);
              // We need to calculate differently from the hook due to being aligned to the right
              const rect = e.currentTarget.getBoundingClientRect();
              resetIncomePosition(
                e.clientX - rect.right + 200 - 8,
                e.clientY - rect.bottom - 8,
              );
            }}
            style={{
              background: 'transparent',
              padding: 0,
              paddingRight: styles.monthRightPadding,
            }}
          >
            <BalanceWithCarryover
              carryover={envelopeBudget.catCarryover(category.id)}
              balance={envelopeBudget.catSumAmount(category.id)}
              goal={envelopeBudget.catGoal(category.id)}
              budgeted={envelopeBudget.catBudgeted(category.id)}
              longGoal={envelopeBudget.catLongGoal(category.id)}
            />
          </Button>
          <Popover
            triggerRef={incomeMenuTriggerRef}
            placement="bottom end"
            isOpen={incomeMenuOpen}
            onOpenChange={() => setIncomeMenuOpen(false)}
            style={{ margin: 1 }}
            isNonModal
            {...incomePosition}
          >
            <IncomeMenu
              categoryId={category.id}
              month={month}
              onBudgetAction={onBudgetAction}
              onShowActivity={onShowActivity}
              onClose={() => setIncomeMenuOpen(false)}
            />
          </Popover>
        </View>
      </Field>
    </View>
  );
}

export { BudgetSummary } from './budgetsummary/BudgetSummary';
