// @ts-strict-ignore
import React, { memo } from 'react';
import type { ComponentProps } from 'react';

import { View } from '@actual-app/components/view';

import { useGlobalPref } from '#hooks/useGlobalPref';

import { MonthPicker } from './MonthPicker';
import { getCategoryColumnWidth, getScrollbarWidth } from './util';

type BudgetPageHeaderProps = {
  startMonth: string;
  onMonthSelect: (month: string) => void;
  numMonths: number;
  monthBounds: ComponentProps<typeof MonthPicker>['monthBounds'];
};

export const BudgetPageHeader = memo<BudgetPageHeaderProps>(
  ({ startMonth, onMonthSelect, numMonths, monthBounds }) => {
    const [categoryExpandedStatePref] = useGlobalPref('categoryExpandedState');
    const categoryExpandedState = categoryExpandedStatePref ?? 0;

    // The strip sits over the months it steps through. With one month that is
    // the whole surface, so it starts on the same left edge as the summary and
    // the table below it; with more it starts where the month columns do.
    const marginLeft =
      numMonths === 1 ? 5 : getCategoryColumnWidth(categoryExpandedState) + 5;

    return (
      <View
        style={{
          marginLeft,
          flexShrink: 0,
        }}
      >
        <View
          style={{
            marginRight: 5 + getScrollbarWidth(),
          }}
        >
          <MonthPicker
            startMonth={startMonth}
            numDisplayed={numMonths}
            monthBounds={monthBounds}
            style={{ paddingTop: 5 }}
            onSelect={month => onMonthSelect(month)}
          />
        </View>
      </View>
    );
  },
);

BudgetPageHeader.displayName = 'BudgetPageHeader';
