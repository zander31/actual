// Shared primitives for the fork's Calendar and Forecast pages. Both answer the
// same question — "am I going to be short, and when?" — so they lead with the
// figure, state the answer beneath it, and rule their surfaces the same way.
import { useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

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

// ── The instrument ──────────────────────────────────────────────────────────
// Every screen shares one shape: a hero figure with its change beneath it, an
// optional scrubbable curve, then rows that each carry their own small history.
// These are that shape's parts, so the screens cannot drift apart.

/**
 * The top of a screen: a small label, the figure, the change or finding under
 * it, and at most one primary action pinned to the right.
 */
export function PageHero({
  label,
  figure,
  color,
  children,
  action,
  aside,
}: {
  label: ReactNode;
  figure: ReactNode;
  color?: string;
  /** The line under the figure — usually a `Delta`, sometimes chips. */
  children?: ReactNode;
  /** The primary action, top right. */
  action?: ReactNode;
  /** A panel that sits opposite the figure instead of an action. */
  aside?: ReactNode;
}) {
  return (
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
          }}
        >
          {label}
        </Text>
        <HeroNumber color={color}>{figure}</HeroNumber>
        {children ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {children}
          </View>
        ) : null}
      </View>
      {action ? <View style={{ flexShrink: 0 }}>{action}</View> : null}
      {aside}
    </View>
  );
}

export type ChartPoint = { label: string; value: number };

/**
 * The hero curve. Hovering scrubs it: the page's figure follows the pointer
 * through `onScrub`, and leaving hands the figure back (`null`). Keyboard users
 * get the same with the arrow keys once the chart has focus.
 */
export function ScrubChart({
  points,
  onScrub,
  height = 230,
  color = theme.reportsChartFill,
}: {
  points: ChartPoint[];
  onScrub?: (index: number | null) => void;
  height?: number;
  color?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [gradientId] = useState(
    () => `scrub-wash-${Math.random().toString(36).slice(2)}`,
  );
  const n = points.length;
  if (n < 2) {
    return <View style={{ height, marginTop: 22 }} />;
  }

  const values = points.map(p => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const top = 20;
  const bottom = height - 20;
  const x = (i: number) => (i / (n - 1)) * 1000;
  const y = (v: number) => bottom - ((v - lo) / span) * (bottom - top);
  const line = values
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L1000 ${height} L0 ${height} Z`;

  const set = (i: number | null) => {
    setIndex(i);
    onScrub?.(i);
  };
  const shown = index ?? n - 1;
  const leftPct = `${(shown / (n - 1)) * 100}%`;
  const topPx = y(values[shown]);

  return (
    <View
      role="img"
      tabIndex={0}
      aria-label={`${points[shown].label}`}
      onMouseMove={(e: MouseEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        set(Math.round(t * (n - 1)));
      }}
      onMouseLeave={() => set(null)}
      onBlur={() => set(null)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') set(Math.max(0, shown - 1));
        if (e.key === 'ArrowRight') set(Math.min(n - 1, shown + 1));
      }}
      style={{
        position: 'relative',
        height,
        marginTop: 22,
        cursor: 'crosshair',
        outline: 'none',
        ':focus-visible': {
          boxShadow: `0 0 0 2px ${theme.formInputBorderSelected}`,
          borderRadius: 6,
        },
      }}
    >
      <svg
        viewBox={`0 0 1000 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ width: '100%', height, display: 'block' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.2" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[top + 6, height / 2 + 3, bottom].map(gy => (
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
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 1,
          left: leftPct,
          backgroundColor: theme.tableBorderHover,
          opacity: index == null ? 0 : 1,
          pointerEvents: 'none',
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 26,
          height: 26,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.18,
          transform: 'translate(-13px, -13px)',
          left: leftPct,
          top: topPx,
          pointerEvents: 'none',
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 11,
          height: 11,
          borderRadius: 999,
          backgroundColor: color,
          boxShadow: `0 0 0 2px ${theme.pageBackground}`,
          transform: 'translate(-5.5px, -5.5px)',
          left: leftPct,
          top: topPx,
          pointerEvents: 'none',
        }}
      />
    </View>
  );
}

/**
 * Capsule tabs: range pickers, filters, month strips. The selected one inverts
 * to ink; the rest are bare text until hovered.
 */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  style,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  style?: Record<string, unknown>;
}) {
  return (
    <View
      role="tablist"
      aria-label={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        ...style,
      }}
    >
      {options.map(o => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={css({
              border: 0,
              cursor: 'pointer',
              font: 'inherit',
              height: 30,
              minWidth: 44,
              padding: '0 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: selected ? 650 : 550,
              letterSpacing: '-0.008em',
              whiteSpace: 'nowrap',
              backgroundColor: selected
                ? theme.buttonPrimaryBackground
                : 'transparent',
              color: selected ? theme.buttonPrimaryText : theme.pageText,
              transition: 'background-color .14s ease, transform .12s ease',
              ':hover': selected
                ? {}
                : { backgroundColor: theme.surfaceSunken },
              ':active': { transform: 'scale(0.96)' },
              ':focus-visible': {
                outline: `2px solid ${theme.formInputBorderSelected}`,
                outlineOffset: 2,
              },
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            })}
          >
            {o.label}
          </button>
        );
      })}
    </View>
  );
}

/**
 * A row's own history, oldest first. Green when the last step went the way
 * `upIsGood` says is good, red when it didn't; the end dot marks "now".
 */
export function Sparkline({
  values,
  width = 76,
  height = 20,
  upIsGood = true,
  color,
}: {
  values: number[];
  width?: number;
  height?: number;
  upIsGood?: boolean;
  color?: string;
}) {
  if (values.length < 2) {
    return <View style={{ width, height, flexShrink: 0 }} />;
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    hi === lo ? height / 2 : height - ((v - lo) / span) * height,
  ]);
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const good = last === prev || last > prev === upIsGood;
  const stroke = color ?? (good ? theme.reportsChartFill : theme.errorBorder);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}
    >
      <path
        d={pts
          .map(
            ([px, py], i) =>
              `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`,
          )
          .join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={pts[pts.length - 1][1]} r="2.6" fill={stroke} />
    </svg>
  );
}

/** A thin capsule bar: a share, a percentage spent, a confidence. */
export function Meter({
  percent,
  color = theme.reportsChartFill,
  height = 6,
  style,
}: {
  percent: number;
  color?: string;
  height?: number;
  style?: Record<string, unknown>;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        // pinned both ways: inside a column a flex:1 bar would grow tall
        height,
        minHeight: height,
        maxHeight: height,
        borderRadius: 999,
        backgroundColor: theme.surfaceSunken,
        overflow: 'hidden',
        ...style,
      }}
    >
      <View
        style={{
          width: `${p}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export type Tone = 'neutral' | 'positive' | 'warning' | 'negative';

/** Ink and wash for a status chip; text always uses the deep steps. */
export function toneColors(tone: Tone) {
  switch (tone) {
    case 'positive':
      return {
        fg: theme.noticeText,
        bg: wash(theme.reportsChartFill, 18, theme.pageBackground),
      };
    case 'warning':
      return {
        fg: theme.warningText,
        bg: wash(theme.warningBorder, 16, theme.pageBackground),
      };
    case 'negative':
      return {
        fg: theme.errorText,
        bg: wash(theme.errorBorder, 14, theme.pageBackground),
      };
    default:
      return { fg: theme.pageTextSubdued, bg: theme.surfaceSunken };
  }
}

/** A small status capsule: "Due", "Over $31", "Needs review". */
export function StatusChip({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const { fg, bg } = toneColors(tone);
  return (
    <Text
      style={{
        ...styles.tnum,
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 9px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '-0.004em',
        whiteSpace: 'nowrap',
        color: fg,
        backgroundColor: bg,
      }}
    >
      {children}
    </Text>
  );
}

/** A section break: the label, a hairline that runs to the edge, a total. */
export function SectionHeader({
  label,
  total,
  style,
}: {
  label: ReactNode;
  total?: ReactNode;
  style?: Record<string, unknown>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 34,
        ...style,
      }}
    >
      <Text style={{ ...sectionLabel, whiteSpace: 'nowrap' }}>{label}</Text>
      <View
        style={{ flex: 1, height: 1, backgroundColor: theme.tableBorder }}
      />
      {total != null ? (
        <Text
          style={{
            ...styles.tnum,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            color: theme.pageText,
          }}
        >
          {total}
        </Text>
      ) : null}
    </View>
  );
}

/** Page padding for an instrument screen. */
export const instrumentPage = {
  padding: '26px 24px 60px',
};

/**
 * A standing note about the data itself, set above the figures it qualifies.
 * Used where a surface would otherwise state a confident number it cannot
 * actually support — an empty projection reads as calm, not as missing.
 */
export function NoticeBar({
  tone = 'warning',
  title,
  detail,
  action,
}: {
  tone?: 'warning' | 'negative';
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  const ink = tone === 'negative' ? theme.errorText : theme.warningText;
  const edge = tone === 'negative' ? theme.errorBorder : theme.warningBorder;
  return (
    <View
      role="status"
      style={{
        marginTop: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: '15px 18px',
        borderRadius: 14,
        flexShrink: 0,
        flexWrap: 'wrap',
        backgroundColor: wash(edge, 16, theme.pageBackground),
      }}
    >
      <View style={{ flex: 1, minWidth: 220, gap: 2 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.014em',
            color: ink,
          }}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            style={{
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.45,
              color: ink,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
