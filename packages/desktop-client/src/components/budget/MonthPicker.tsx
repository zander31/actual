// @ts-strict-ignore
import React, { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SvgCheveronLeft,
  SvgCheveronRight,
} from '@actual-app/components/icons/v1';
import { SvgCalendar } from '@actual-app/components/icons/v2';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { Link } from '#components/common/Link';
import { useLocale } from '#hooks/useLocale';
import { useResizeObserver } from '#hooks/useResizeObserver';

import type { MonthBounds } from './MonthsContext';

// The strip fills its width with months, but the steppers at either end are not
// months: counting without them packed the run past the right edge.
const MONTH_CELL_WIDTH = 44;
const STEPPER_WIDTH = 170;
// The instrument's strip: separate capsules with a gap, steppers after the run.
const STRIP_CELL_WIDTH = 62;
const STRIP_STEPPER_WIDTH = 130;

type MonthPickerProps = {
  startMonth: string;
  numDisplayed: number;
  monthBounds: MonthBounds;
  style: CSSProperties;
  onSelect: (month: string) => void;
  /**
   * `strip` sets each month as its own capsule, left-aligned, with today and
   * the steppers after the run (the envelope budget's instrument layout).
   */
  variant?: 'default' | 'strip';
};

export const MonthPicker = ({
  startMonth,
  numDisplayed,
  monthBounds,
  style,
  onSelect,
  variant = 'default',
}: MonthPickerProps) => {
  const isStrip = variant === 'strip';
  const locale = useLocale();
  const { t } = useTranslation();
  const [hoverId, setHoverId] = useState(null);
  const [targetMonthCount, setTargetMonthCount] = useState(12);

  const currentMonth = monthUtils.currentMonth();
  const firstSelectedMonth = startMonth;

  const lastSelectedMonth = monthUtils.addMonths(
    firstSelectedMonth,
    numDisplayed - 1,
  );

  const range = monthUtils.rangeInclusive(
    monthUtils.subMonths(
      firstSelectedMonth,
      Math.floor(targetMonthCount / 2 - numDisplayed / 2),
    ),
    monthUtils.addMonths(
      lastSelectedMonth,
      Math.floor(targetMonthCount / 2 - numDisplayed / 2),
    ),
  );

  const firstSelectedIndex =
    Math.floor(range.length / 2) - Math.floor(numDisplayed / 2);
  const lastSelectedIndex = firstSelectedIndex + numDisplayed - 1;

  const [size, setSize] = useState('small');
  const containerRef = useResizeObserver(rect => {
    setSize(rect.width <= 400 ? 'small' : 'big');
    setTargetMonthCount(
      isStrip
        ? Math.min(
            Math.max(
              Math.floor((rect.width - STRIP_STEPPER_WIDTH) / STRIP_CELL_WIDTH),
              3,
            ),
            24,
          )
        : Math.min(
            Math.max(
              Math.floor((rect.width - STEPPER_WIDTH) / MONTH_CELL_WIDTH),
              12,
            ),
            24,
          ),
    );
  });

  const stepper = (
    onPress: () => void,
    title: string,
    icon: ReactNode,
    side: 'left' | 'right',
  ) => (
    <Link
      variant="button"
      buttonVariant="bare"
      onPress={onPress}
      aria-label={title}
      style={{
        padding: 0,
        width: isStrip ? 32 : 30,
        height: isStrip ? 32 : 30,
        borderRadius: 999,
        ...(!isStrip && side === 'left' && { marginRight: 10 }),
        ...(!isStrip && side === 'right' && { marginLeft: 10 }),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.surfaceSunken,
      }}
    >
      <View title={title}>{icon}</View>
    </Link>
  );
  const iconStyle = { width: 16, height: 16 };
  const todayButton = stepper(
    () => onSelect(currentMonth),
    t('Today'),
    <SvgCalendar style={iconStyle} />,
    'left',
  );
  const prevButton = stepper(
    () => onSelect(monthUtils.prevMonth(startMonth)),
    t('Previous month'),
    <SvgCheveronLeft style={iconStyle} />,
    'left',
  );
  const nextButton = stepper(
    () => onSelect(monthUtils.nextMonth(startMonth)),
    t('Next month'),
    <SvgCheveronRight style={iconStyle} />,
    'right',
  );

  const yearHeadersShown = [];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style,
      }}
    >
      <View
        innerRef={containerRef}
        style={{
          flexDirection: 'row',
          flex: 1,
          alignItems: 'center',
          justifyContent: isStrip ? 'flex-start' : 'center',
          ...(isStrip && { gap: 6 }),
        }}
      >
        {!isStrip && todayButton}
        {!isStrip && prevButton}
        {range.map((month, idx) => {
          const monthName = monthUtils.format(month, 'MMM', locale);
          const selected =
            idx >= firstSelectedIndex && idx <= lastSelectedIndex;

          const lastHoverId = hoverId + numDisplayed - 1;
          const hovered =
            hoverId === null ? false : idx >= hoverId && idx <= lastHoverId;

          const current = currentMonth === month;
          const year = monthUtils.getYear(month);

          let showYearHeader = false;

          if (!yearHeadersShown.includes(year)) {
            yearHeadersShown.push(year);
            showYearHeader = true;
          }

          const isMonthBudgeted =
            month >= monthBounds.start && month <= monthBounds.end;

          return (
            <View
              key={month}
              data-testid={selected ? 'selected-budget-month' : undefined}
              data-month={selected ? month : undefined}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                height: 30,
                width: size === 'big' ? '44px' : '30px',
                textAlign: 'center',
                userSelect: 'none',
                cursor: 'default',
                borderRadius: 0,
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.012em',
                color: theme.pageTextLight,
                transition: 'background-color .14s ease, color .14s ease',
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                },
                ...(!isMonthBudgeted && {
                  textDecoration: 'line-through',
                  color: theme.pageTextSubdued,
                }),
                ...(selected && {
                  backgroundColor: theme.buttonPrimaryBackground,
                  color: theme.buttonPrimaryText,
                  fontWeight: 600,
                }),
                ...((hovered || selected) && {
                  borderRadius: 0,
                  cursor: 'pointer',
                }),
                ...(hoverId !== null &&
                  !hovered &&
                  selected && {
                    filter: 'brightness(65%)',
                  }),
                ...(hovered &&
                  !selected && {
                    backgroundColor: theme.buttonBareBackgroundHover,
                  }),
                ...(!hovered &&
                  !selected &&
                  current && {
                    backgroundColor: theme.buttonBareBackgroundHover,
                    filter: 'brightness(120%)',
                  }),
                ...(hovered &&
                  selected &&
                  current && {
                    filter: 'brightness(120%)',
                  }),
                ...(hovered &&
                  selected && {
                    backgroundColor: theme.buttonPrimaryBackground,
                  }),
                ...((idx === firstSelectedIndex ||
                  (idx === hoverId && !selected)) && {
                  borderTopLeftRadius: 999,
                  borderBottomLeftRadius: 999,
                }),
                ...((idx === lastSelectedIndex ||
                  (idx === lastHoverId && !selected)) && {
                  borderTopRightRadius: 999,
                  borderBottomRightRadius: 999,
                }),
                ...(current && !selected && { color: theme.pageText }),
                ...(isStrip && {
                  // each month its own capsule: no joined run, no dimming
                  height: 32,
                  width: 'auto',
                  minWidth: size === 'big' ? 44 : 32,
                  padding: size === 'big' ? '0 15px' : '0 10px',
                  borderRadius: 999,
                  filter: 'none',
                  cursor: 'pointer',
                  fontWeight: selected ? 650 : 500,
                  backgroundColor: selected
                    ? theme.buttonPrimaryBackground
                    : hovered
                      ? theme.surfaceSunken
                      : 'transparent',
                  ':focus-visible': {
                    outline: `2px solid ${theme.formInputBorderSelected}`,
                    outlineOffset: 2,
                  },
                }),
              }}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(month);
                }
              }}
              onClick={() => onSelect(month)}
              onMouseEnter={() => setHoverId(idx)}
              onMouseLeave={() => setHoverId(null)}
            >
              <View>
                {size === 'small' ? monthName[0] : monthName}
                {showYearHeader && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -16,
                      left: 0,
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: isMonthBudgeted
                        ? theme.pageText
                        : theme.pageTextSubdued,
                    }}
                  >
                    {year}
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {isStrip ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginLeft: 'auto',
              paddingLeft: 10,
            }}
          >
            {todayButton}
            {prevButton}
            {nextButton}
          </View>
        ) : (
          <>
            {nextButton}
            {/*Keep range centered*/}
            <span style={{ width: 40, marginLeft: 10 }} />
          </>
        )}
      </View>
    </View>
  );
};
