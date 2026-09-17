// @ts-strict-ignore
import React, { useEffect } from 'react';
import type { ComponentProps } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useHotkeys } from 'react-hotkeys-hook';
import { AutoSizer } from 'react-virtualized-auto-sizer';

import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import {
  BUDGET_RAIL_GAP,
  BUDGET_RAIL_WIDTH,
  BudgetHero,
  BudgetRail,
  EnvelopesSectionHeader,
  MonthStandsCard,
} from '#components/custom/BudgetInstrument';
import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useGlobalPref } from '#hooks/useGlobalPref';

import { useBudgetMonthCount } from './BudgetMonthCountContext';
import { BudgetPageHeader } from './BudgetPageHeader';
import { BudgetTable } from './BudgetTable';
import { MonthPicker } from './MonthPicker';
import { getCategoryColumnWidth, getMonthColumnWidth } from './util';

// The envelope budget is laid out as an instrument: the rail sits beside the
// envelopes once there is room for both, and a single month widens past the
// upstream column so its history, bar and status have space to be read.
const RAIL_MIN_WIDTH = 1180;
const INSTRUMENT_SINGLE_MONTH_MAX_WIDTH = 1120;

function getNumPossibleMonths(width: number, categoryWidth: number) {
  const estimatedTableWidth = width - categoryWidth;

  if (estimatedTableWidth < 500) {
    return 1;
  } else if (estimatedTableWidth < 750) {
    return 2;
  } else if (estimatedTableWidth < 1000) {
    return 3;
  } else if (estimatedTableWidth < 1250) {
    return 4;
  } else if (estimatedTableWidth < 1500) {
    return 5;
  }

  return 6;
}

type DynamicBudgetTableProps = {
  width: number;
  height: number;
} & AutoSizingBudgetTableProps;

const DynamicBudgetTable = ({
  type,
  width,
  height,
  prewarmStartMonth,
  startMonth,
  maxMonths = 3,
  monthBounds,
  onMonthSelect,
  onBudgetAction,
  ...props
}: DynamicBudgetTableProps) => {
  const { setDisplayMax } = useBudgetMonthCount();
  const [categoryExpandedStatePref] = useGlobalPref('categoryExpandedState');
  const isGoalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const categoryExpandedState = categoryExpandedStatePref ?? 0;

  const isInstrument = type === 'envelope';
  const showRail = isInstrument && width >= RAIL_MIN_WIDTH;
  const tableWidth = showRail
    ? width - BUDGET_RAIL_WIDTH - BUDGET_RAIL_GAP
    : width;

  const categoryWidth = getCategoryColumnWidth(categoryExpandedState);
  const numPossible = getNumPossibleMonths(tableWidth, categoryWidth);
  const numMonths = Math.min(numPossible, maxMonths);
  const maxWidth =
    isInstrument && numMonths === 1
      ? Math.max(
          INSTRUMENT_SINGLE_MONTH_MAX_WIDTH,
          categoryWidth + getMonthColumnWidth(1),
        )
      : categoryWidth + getMonthColumnWidth(numMonths) * numMonths;

  // The hero, bar and rail speak for one month: today's when it is on screen,
  // otherwise the first month shown.
  const lastShownMonth = monthUtils.addMonths(startMonth, numMonths - 1);
  const today = monthUtils.currentMonth();
  const focusMonth =
    today >= startMonth && today <= lastShownMonth ? today : startMonth;

  useEffect(() => {
    setDisplayMax(numPossible);
  }, [setDisplayMax, numPossible]);

  function getValidMonth(month) {
    const start = monthBounds.start;
    const end = monthUtils.subMonths(monthBounds.end, numMonths - 1);

    if (month < start) {
      return start;
    } else if (month > end) {
      return end;
    }
    return month;
  }

  function _onMonthSelect(month) {
    onMonthSelect(getValidMonth(month), numMonths);
  }

  useHotkeys(
    'left',
    () => {
      _onMonthSelect(monthUtils.prevMonth(startMonth));
    },
    {
      preventDefault: true,
      scopes: ['app'],
    },
    [_onMonthSelect, startMonth],
  );
  useHotkeys(
    'right',
    () => {
      _onMonthSelect(monthUtils.nextMonth(startMonth));
    },
    {
      preventDefault: true,
      scopes: ['app'],
    },
    [_onMonthSelect, startMonth],
  );
  useHotkeys(
    '0',
    () => {
      _onMonthSelect(
        monthUtils.subMonths(
          monthUtils.currentMonth(),
          type === 'envelope'
            ? Math.floor((numMonths - 1) / 2)
            : numMonths === 2
              ? 1
              : Math.max(numMonths - 2, 0),
        ),
      );
    },
    {
      preventDefault: true,
      scopes: ['app'],
    },
    [_onMonthSelect, startMonth, numMonths],
  );
  useHotkeys(
    'shift+t',
    () => {
      onBudgetAction(startMonth, 'overwrite-goal-template', null);
    },
    {
      preventDefault: true,
      scopes: ['app'],
      enabled: isGoalTemplatesEnabled,
    },
    [onBudgetAction, startMonth, isGoalTemplatesEnabled],
  );

  return (
    <View
      style={{
        width,
        height,
        alignItems: 'center',
        opacity: width <= 0 || height <= 0 ? 0 : 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: BUDGET_RAIL_GAP,
          width: '100%',
          maxWidth: showRail
            ? maxWidth + BUDGET_RAIL_WIDTH + BUDGET_RAIL_GAP
            : maxWidth,
          flex: 1,
          minHeight: 0,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
            {!isInstrument && (
              <BudgetPageHeader
                startMonth={prewarmStartMonth}
                numMonths={numMonths}
                monthBounds={monthBounds}
                onMonthSelect={_onMonthSelect}
              />
            )}
            <BudgetTable
              type={type}
              prewarmStartMonth={prewarmStartMonth}
              startMonth={startMonth}
              numMonths={numMonths}
              monthBounds={monthBounds}
              onBudgetAction={onBudgetAction}
              header={
                isInstrument ? (
                  <View style={{ paddingTop: 26, flexShrink: 0 }}>
                    <BudgetHero month={focusMonth} />
                    <MonthPicker
                      startMonth={prewarmStartMonth}
                      numDisplayed={numMonths}
                      monthBounds={monthBounds}
                      variant="strip"
                      style={{ marginTop: 22 }}
                      onSelect={month => _onMonthSelect(month)}
                    />
                    <MonthStandsCard month={focusMonth} />
                    {!showRail && <BudgetRail month={focusMonth} inline />}
                    <EnvelopesSectionHeader showHistory={numMonths === 1} />
                  </View>
                ) : undefined
              }
              {...props}
            />
          </ErrorBoundary>
        </View>
        {showRail && (
          <View
            style={{
              width: BUDGET_RAIL_WIDTH,
              flexShrink: 0,
              minHeight: 0,
              overflowY: 'auto',
              paddingTop: 26,
              paddingBottom: 16,
            }}
          >
            <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
              <BudgetRail month={focusMonth} />
            </ErrorBoundary>
          </View>
        )}
      </View>
    </View>
  );
};

DynamicBudgetTable.displayName = 'DynamicBudgetTable';

type AutoSizingBudgetTableProps = Omit<
  ComponentProps<typeof BudgetTable>,
  'numMonths'
> & {
  maxMonths: number;
  onMonthSelect: (month: string, numMonths: number) => void;
};

export const AutoSizingBudgetTable = (props: AutoSizingBudgetTableProps) => {
  return (
    <AutoSizer
      renderProp={({ width = 0, height = 0 }) => {
        if (width === 0 || height === 0) {
          return null;
        }

        return <DynamicBudgetTable width={width} height={height} {...props} />;
      }}
    />
  );
};

AutoSizingBudgetTable.displayName = 'AutoSizingBudgetTable';
