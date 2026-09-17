// The pieces an envelope row carries on the budget instrument: its six months
// of spend, a spent-of-available bar, and a status capsule. Kept apart from the
// page-level instrument so the upstream row components can use them without an
// import cycle through the summary and its menus.
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useSpreadsheet } from '#hooks/useSpreadsheet';

import { Meter, Sparkline, toneColors } from './primitives';
import type { Tone } from './primitives';

/** How many months of spend each envelope's history line covers. */
const HISTORY_MONTHS = 6;

// ── Spreadsheet access ──────────────────────────────────────────────────────

/**
 * Subscribe to any number of cells, each named in full (`budget202609!to-budget`).
 * The per-row hooks upstream bind one cell at a time; the rail and the history
 * lines need a list whose length follows the data.
 */
export function useCells(
  names: readonly string[],
): Record<string, number | null> {
  const spreadsheet = useSpreadsheet();
  const [values, setValues] = useState<Record<string, number | null>>({});
  const key = names.join('|');

  useEffect(() => {
    const unbinds = key
      .split('|')
      .filter(Boolean)
      .map(full => {
        const idx = full.indexOf('!');
        const sheet = full.slice(0, idx);
        const name = full.slice(idx + 1);
        return spreadsheet.bind(sheet, name, node => {
          const value = typeof node.value === 'number' ? node.value : null;
          setValues(prev =>
            prev[full] === value ? prev : { ...prev, [full]: value },
          );
        });
      });
    return () => unbinds.forEach(unbind => unbind());
  }, [spreadsheet, key]);

  return values;
}

export function cell(month: string, name: string) {
  return `${monthUtils.sheetForMonth(month)}!${name}`;
}

// ── Row pieces ──────────────────────────────────────────────────────────────

/**
 * Six months of spend ending at `month`, oldest first. A rising last step is
 * drawn red: for spending, up is not the good direction.
 */
export function SpendHistory({
  month,
  id,
  isGroup = false,
}: {
  month: string;
  id: string;
  isGroup?: boolean;
}) {
  const field = isGroup ? `group-sum-amount-${id}` : `sum-amount-${id}`;
  const months = useMemo(
    () =>
      Array.from({ length: HISTORY_MONTHS }, (_, i) =>
        monthUtils.subMonths(month, HISTORY_MONTHS - 1 - i),
      ),
    [month],
  );
  const names = useMemo(() => months.map(m => cell(m, field)), [months, field]);
  const cells = useCells(names);
  const values = names
    .map(name => cells[name])
    .filter((v): v is number => v != null)
    .map(v => -v);

  return <Sparkline values={values} width={76} height={20} upIsGood={false} />;
}

/** What an envelope's figures say about it: how full the bar is, and its chip. */
export function useEnvelopeState(
  budgeted: number | null,
  spentSigned: number | null,
  balance: number | null,
) {
  const { t } = useTranslation();
  const format = useFormat();
  const spent = Math.max(0, -(spentSigned ?? 0));
  const bal = balance ?? 0;
  // what the envelope had to spend this month: budgeted plus anything carried in
  const had = bal + spent;
  const pct =
    had > 0 ? Math.min(100, (spent / had) * 100) : spent > 0 ? 100 : 0;

  let tone: Tone;
  let label: string;
  let fill: string;
  if (bal < 0) {
    tone = 'negative';
    label = t('Over {{amount}}', {
      amount: format(-bal, 'financial-no-decimals'),
    });
    fill = theme.errorBorder;
  } else if (bal === 0) {
    tone = 'neutral';
    label =
      (budgeted ?? 0) === 0 && spent === 0 ? t('Empty') : t('Fully spent');
    fill = theme.reportsChartFill;
  } else if (pct > 90) {
    tone = 'warning';
    label = t('{{amount}} left', {
      amount: format(bal, 'financial-no-decimals'),
    });
    fill = theme.warningBorder;
  } else {
    tone = 'neutral';
    label = t('{{percent}}% left', { percent: Math.round(100 - pct) });
    fill = theme.reportsChartFill;
  }
  return { pct, tone, label, fill };
}

/** The spent-of-available bar. */
export function EnvelopeMeter({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  return (
    <View
      aria-hidden="true"
      style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
    >
      <Meter percent={percent} color={color} style={{ flex: 'none' }} />
    </View>
  );
}

/** The status capsule at the end of an envelope row. */
export function EnvelopeChip({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  const { fg, bg } = toneColors(tone);
  return (
    <PrivacyFilter>
      <Text
        style={{
          ...styles.tnum,
          display: 'inline-flex',
          alignItems: 'center',
          height: 26,
          padding: '0 11px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 650,
          letterSpacing: '-0.006em',
          whiteSpace: 'nowrap',
          color: fg,
          backgroundColor: bg,
        }}
      >
        {children}
      </Text>
    </PrivacyFilter>
  );
}
