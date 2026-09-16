// Shared primitives for the fork's Calendar and Forecast pages. Both answer the
// same question — "am I going to be short, and when?" — so they lead with the
// figure, state the answer beneath it, and rule their surfaces the same way.
import type { ReactNode } from 'react';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { dayColor } from './forecastMath';

/** Mix a theme colour into a surface. Both sides are `var(--color-*)`. */
export function wash(color: string, percent: number, surface: string): string {
  return `color-mix(in oklab, ${color} ${percent}%, ${surface})`;
}

/**
 * Ink for a projected balance. These resolve to the deep money steps, which
 * clear 4.5:1 on white — the saturated brand steps are fills, never figures.
 */
export function balanceInk(balance: number): string {
  switch (dayColor(balance)) {
    case 'red':
      return theme.errorText;
    case 'yellow':
      return theme.warningText;
    default:
      return theme.noticeText;
  }
}

/**
 * The *fill* for a projected balance — the saturated brand steps. These are for
 * bars, strokes and marks only; `balanceInk` is what text uses.
 */
export function balanceFill(balance: number): string {
  switch (dayColor(balance)) {
    case 'red':
      return theme.errorBorder;
    case 'yellow':
      return theme.warningBorder;
    default:
      return theme.reportsChartFill;
  }
}

/**
 * The direction mark that sits against a delta. Drawn, not a unicode glyph, so
 * it keeps a consistent optical size and baseline next to tabular figures.
 */
export function Direction({ up, color }: { up: boolean; color: string }) {
  return (
    <svg
      width="9"
      height="7"
      viewBox="0 0 9 7"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <path d={up ? 'M4.5 0 9 7H0z' : 'M4.5 7 0 0h9z'} fill={color} />
    </svg>
  );
}

/**
 * A change, set the way a brokerage sets one: mark, then the amount and the
 * percentage carrying the colour, then the period in plain neutral text. All
 * one size — the colour and the mark do the work, not a size jump.
 */
export function Delta({
  up,
  amount,
  percent,
  period,
}: {
  up: boolean;
  amount: string;
  percent?: string;
  period?: string;
}) {
  const color = up ? theme.noticeText : theme.errorText;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}
    >
      <Direction up={up} color={color} />
      <Text
        style={{
          ...styles.tnum,
          color,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.012em',
        }}
      >
        {amount}
        {percent ? ` (${percent})` : ''}
      </Text>
      {period ? (
        <Text
          style={{
            color: theme.pageTextLight,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: '-0.012em',
          }}
        >
          {period}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The sentence under a hero figure: what the number means, in plain words.
 * Secondary by construction — the figure above it carries the weight.
 */
export function Finding({
  children,
  style,
}: {
  children: ReactNode;
  style?: Record<string, unknown>;
}) {
  return (
    <Text
      style={{
        fontSize: 15,
        fontWeight: 500,
        color: theme.pageTextLight,
        lineHeight: 1.45,
        letterSpacing: '-0.012em',
        maxWidth: '62ch',
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** A figure inside a sentence — tabular, weighted, coloured by what it means. */
export function Figure({
  children,
  color = theme.pageText,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <Text
      style={{
        ...styles.displayFace,
        fontSize: 15,
        fontWeight: 600,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Text>
  );
}

/** A hairline. Structure comes from these, not from boxes. */
export function Rule({ style }: { style?: Record<string, unknown> }) {
  return (
    <View
      style={{
        height: 1,
        flexShrink: 0,
        backgroundColor: theme.tableBorder,
        ...style,
      }}
    />
  );
}

/**
 * Section and column labels. Sentence case, semibold, subdued — a brokerage
 * labels a number the way it would say it aloud, not in spaced capitals.
 */
export const sectionLabel = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '-0.014em',
  color: theme.pageTextLight,
};

/** The smallest label tier, for table column heads. */
export const columnLabel = {
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '-0.006em',
  color: theme.pageTextSubdued,
};

/**
 * The hero figure. The whole hierarchy is this: the number first at a size
 * nothing else competes with, the explanation small underneath.
 */
export function HeroNumber({
  children,
  color = theme.pageText,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: Record<string, unknown>;
}) {
  return (
    <Text style={{ ...styles.heroNumber, color, ...style }}>{children}</Text>
  );
}

/**
 * A legend entry: the mark, the figure it stands for in ink, then what it means
 * in plain grey. Reads as a sentence rather than a key.
 */
export function LegendRow({
  swatch,
  value,
  label,
}: {
  swatch: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        flexShrink: 0,
      }}
    >
      {swatch}
      <Text
        style={{
          ...styles.tnum,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.014em',
          color: theme.pageText,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '-0.012em',
          color: theme.pageTextLight,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** A filled chip of colour, the size of a lowercase letter. */
export function Swatch({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

/** The dashed mark a reference line uses in a legend. */
export function DashSwatch({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 14,
        height: 2,
        borderRadius: 2,
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * A round icon button — the reference's back/step control. Grey by rest, ink on
 * hover; the icon never carries the affordance on its own.
 */
export function RoundButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className={css({
        width: 36,
        height: 36,
        borderRadius: 999,
        border: 0,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer',
        color: theme.pageText,
        backgroundColor: theme.surfaceSunken,
        transition: 'background-color .14s ease, transform .12s ease',
        ':hover': { backgroundColor: theme.tableBorder },
        ':active': { transform: 'scale(0.94)' },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      })}
    >
      {children}
    </button>
  );
}

/** A capsule that reads as a value, not a control. */
export const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 28,
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '-0.008em',
};
