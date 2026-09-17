// @ts-strict-ignore
import type { CSSProperties } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import {
  currencyToAmount,
  integerToCurrency,
} from '@actual-app/core/shared/util';
import type { Handlers } from '@actual-app/core/types/handlers';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import type { SyncedPrefs } from '@actual-app/core/types/prefs';
import { t } from 'i18next';

import type { DropPosition } from '#components/sort';
import type { useSpreadsheet } from '#hooks/useSpreadsheet';

import { getValidMonthBounds } from './MonthsContext';

// The budget surface's column geometry.
//
// Upstream sized these against a 240px sidebar eating the left of the window.
// This fork retired that sidebar for the top nav, so the table *is* the page and
// the columns take the room it freed: names get space to be read, and a single
// month spreads into a card wide enough for its tiles to sit in one row.
const CATEGORY_COLUMN_WIDTH = 280;
const CATEGORY_COLUMN_EXPAND_STEP = 100;
const MONTH_COLUMN_WIDTH = 500;
// One or two months leave slack a 500px column cannot spend. Past that the page
// would outrun the window, so the column tightens back to upstream's measure.
const MONTH_COLUMN_WIDTH_ROOMY = 640;

export function getCategoryColumnWidth(expandedState: number) {
  return CATEGORY_COLUMN_WIDTH + CATEGORY_COLUMN_EXPAND_STEP * expandedState;
}

export function getMonthColumnWidth(numMonths: number) {
  return numMonths <= 2 ? MONTH_COLUMN_WIDTH_ROOMY : MONTH_COLUMN_WIDTH;
}

export function addToBeBudgetedGroup(groups: CategoryGroupEntity[]) {
  return [
    {
      id: 'to-budget',
      name: t('To Budget'),
      categories: [
        {
          id: 'to-budget',
          name: t('To Budget'),
          group: 'to-budget',
        },
      ],
    } as CategoryGroupEntity,
    ...groups,
  ];
}

export function removeCategoriesFromGroups(
  categoryGroups: CategoryGroupEntity[],
  ...categoryIds: CategoryEntity['id'][]
) {
  if (categoryIds.length === 0) return categoryGroups;

  const categoryIdsSet = new Set(categoryIds);

  return categoryGroups
    .map(group => ({
      ...group,
      categories:
        group.categories?.filter(cat => !categoryIdsSet.has(cat.id)) ?? [],
    }))
    .filter(group => group.categories?.length);
}

export function separateGroups(categoryGroups: CategoryGroupEntity[]) {
  return [
    categoryGroups.filter(g => !g.is_income),
    categoryGroups.find(g => g.is_income),
  ] as const;
}

export function makeAmountGrey(value: number | string | null): CSSProperties {
  return value === 0 || value === '0' || value === '' || value == null
    ? { color: theme.budgetNumberZero }
    : null;
}

export function makeBalanceAmountStyle(
  value: number,
  goalValue?: number | null,
  budgetedValue?: number | null,
) {
  // Converts an integer currency value to a normalized decimal amount.
  // First converts the integer to currency format, then to a decimal amount.
  // Uses integerToCurrency to display the value correctly according to user prefs.

  const normalizeIntegerValue = (val: number | null | undefined) =>
    typeof val === 'number' ? currencyToAmount(integerToCurrency(val)) : 0;

  const currencyValue = normalizeIntegerValue(value);

  if (currencyValue < 0) {
    return { color: theme.budgetNumberNegative };
  }

  if (goalValue == null) {
    const greyed = makeAmountGrey(currencyValue);
    if (greyed) {
      return greyed;
    }
    return { color: theme.budgetNumberPositive };
  } else {
    const budgetedAmount = normalizeIntegerValue(budgetedValue);
    const goalAmount = normalizeIntegerValue(goalValue);

    if (budgetedAmount < goalAmount) {
      return { color: theme.templateNumberUnderFunded };
    }
    return { color: theme.templateNumberFunded };
  }
}

export function makeAmountFullStyle(
  value: number,
  colors?: {
    positiveColor?: string;
    negativeColor?: string;
    zeroColor?: string;
  },
) {
  const positiveColorToUse =
    colors?.positiveColor || theme.budgetNumberPositive;
  const negativeColorToUse =
    colors?.negativeColor || theme.budgetNumberNegative;
  const zeroColorToUse = colors?.zeroColor || theme.budgetNumberZero;
  return {
    color:
      value < 0
        ? negativeColorToUse
        : value === 0
          ? zeroColorToUse
          : positiveColorToUse,
  };
}

export function findSortDown<T extends { id: string }>(
  arr: T[],
  pos: DropPosition | null,
  targetId: string,
) {
  if (pos === 'top') {
    return { targetId };
  } else {
    const idx = arr.findIndex(item => item.id === targetId);

    if (idx === -1) {
      throw new Error('findSort: item not found: ' + targetId);
    }

    const newIdx = idx + 1;
    if (newIdx < arr.length) {
      return { targetId: arr[newIdx].id };
    } else {
      // Move to the end
      return { targetId: null };
    }
  }
}

export function findSortUp<T extends { id: string }>(
  arr: T[],
  pos: DropPosition | null,
  targetId: string,
) {
  if (pos === 'bottom') {
    return { targetId };
  } else {
    const idx = arr.findIndex(item => item.id === targetId);

    if (idx === -1) {
      throw new Error('findSort: item not found: ' + targetId);
    }

    const newIdx = idx - 1;
    if (newIdx >= 0) {
      return { targetId: arr[newIdx].id };
    } else {
      // Move to the beginning
      return { targetId: null };
    }
  }
}

let scrollbarWidth: number | null = null;

export function getScrollbarWidth() {
  // The header row and the month strip have to stop exactly where the scrolled
  // rows stop, or the column totals sit off the figures beneath them. A guessed
  // width was 4px out, which is enough to see in a column of right-aligned
  // money; measure the real one once instead. Overlay scrollbars measure 0.
  if (scrollbarWidth == null) {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute;visibility:hidden;overflow:scroll;width:100px;height:100px';
    document.body.appendChild(probe);
    scrollbarWidth = probe.offsetWidth - probe.clientWidth;
    probe.remove();
  }
  return scrollbarWidth;
}

export async function prewarmMonth(
  budgetType: SyncedPrefs['budgetType'],
  spreadsheet: ReturnType<typeof useSpreadsheet>,
  month: string,
) {
  const method: keyof Handlers =
    budgetType === 'tracking'
      ? 'tracking-budget-month'
      : 'envelope-budget-month';

  const values = await send(method, { month });

  for (const value of values) {
    spreadsheet.prewarmCache(value.name, value);
  }
}

export async function prewarmAllMonths(
  budgetType: SyncedPrefs['budgetType'],
  spreadsheet: ReturnType<typeof useSpreadsheet>,
  bounds: { start: string; end: string },
  startMonth: string,
) {
  const numMonths = 3;

  bounds = getValidMonthBounds(
    bounds,
    monthUtils.subMonths(startMonth, 1),
    monthUtils.addMonths(startMonth, numMonths + 1),
  );
  const months = monthUtils.rangeInclusive(bounds.start, bounds.end);

  await Promise.all(
    months.map(month => prewarmMonth(budgetType, spreadsheet, month)),
  );
}
