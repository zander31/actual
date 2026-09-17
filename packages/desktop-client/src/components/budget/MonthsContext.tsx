// @ts-strict-ignore
import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';

export type MonthBounds = {
  start: string;
  end: string;
};

export function getValidMonthBounds(
  bounds: MonthBounds,
  startMonth: undefined | string,
  endMonth: string,
) {
  return {
    start: startMonth < bounds.start ? bounds.start : startMonth,
    end: endMonth > bounds.end ? bounds.end : endMonth,
  };
}

type MonthsContextProps = {
  months: string[];
  type: string;
};

export const MonthsContext = createContext<MonthsContextProps>(null);

type MonthsProviderProps = {
  startMonth: string | undefined;
  numMonths: number;
  monthBounds: MonthBounds;
  type: string;
  children: ReactNode;
};

export function MonthsProvider({
  startMonth,
  numMonths,
  monthBounds,
  type,
  children,
}: MonthsProviderProps) {
  const endMonth = monthUtils.addMonths(startMonth, numMonths - 1);
  const bounds = getValidMonthBounds(monthBounds, startMonth, endMonth);
  const months = monthUtils.rangeInclusive(bounds.start, bounds.end);

  return (
    <MonthsContext.Provider value={{ months, type }}>
      {children}
    </MonthsContext.Provider>
  );
}

/**
 * A single envelope month is drawn as the fork's instrument: taller rows that
 * carry each envelope's history, a spent bar and a status. Over several months
 * (and on the tracking budget) the grid keeps upstream's density.
 */
export function useIsInstrumentMonth() {
  const context = useContext(MonthsContext);
  return context?.type === 'envelope' && context.months.length === 1;
}

export const INSTRUMENT_ROW_HEIGHT = 50;
export const INSTRUMENT_GROUP_ROW_HEIGHT = 54;
