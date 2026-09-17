import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { EnvelopeCellValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { CellValueText } from '#components/spreadsheet/CellValue';
import { useFormat } from '#hooks/useFormat';
import type { FormatType } from '#hooks/useFormat';
import { envelopeBudget } from '#spreadsheet/bindings';

/**
 * Creates a formatter that displays values with explicit +/- signs.
 * Uses Math.abs to avoid double-negative display (e.g., "--$0.00").
 *
 * @param format - The format function from useFormat hook
 * @param invert - If true, shows '-' for positive and '+' for negative
 */
function makeSignedFormatter(
  format: ReturnType<typeof useFormat>,
  invert = false,
) {
  return (value: number, type?: FormatType) => {
    const v = format(Math.abs(value), type);
    if (value === 0) {
      return '-' + v;
    }
    const isPositive = value > 0;
    return invert
      ? isPositive
        ? '-' + v
        : '+' + v
      : isPositive
        ? '+' + v
        : '-' + v;
  };
}

/**
 * One figure in the month's summary, as a tile: the label small and quiet, the
 * figure below it in the money tier. The row of them is the first thing read on
 * the surface, so each one has to survive being glanced at.
 */
function TotalTile({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        gap: 3,
        padding: '11px 13px 12px',
        borderRadius: 10,
        backgroundColor: theme.tableBackground,
        boxShadow: `inset 0 0 0 1px ${theme.tableBorder}`,
        minWidth: 0,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '-0.006em',
          color: theme.pageTextSubdued,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

const figure: CSSProperties = {
  ...styles.tnum,
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '-0.028em',
  color: theme.pageText,
};

type TotalsListProps = {
  prevMonthName: string;
  style?: CSSProperties;
};

export function TotalsList({ prevMonthName, style }: TotalsListProps) {
  const format = useFormat();
  const signedFormatter = makeSignedFormatter(format);
  const invertedSignedFormatter = makeSignedFormatter(format, true);

  return (
    <View
      style={{
        display: 'grid',
        // four across where there is room, two-up where there is not
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 8,
        ...style,
      }}
    >
      <TotalTile label={<Trans>Available funds</Trans>}>
        <EnvelopeCellValue
          binding={envelopeBudget.incomeAvailable}
          type="financial"
        >
          {props => <CellValueText {...props} style={figure} />}
        </EnvelopeCellValue>
      </TotalTile>

      <TotalTile label={<Trans>Overspent in {{ prevMonthName }}</Trans>}>
        <EnvelopeCellValue
          binding={envelopeBudget.lastMonthOverspent}
          type="financial"
        >
          {props => (
            <CellValueText
              {...props}
              style={figure}
              formatter={signedFormatter}
            />
          )}
        </EnvelopeCellValue>
      </TotalTile>

      <TotalTile label={<Trans>Budgeted</Trans>}>
        <EnvelopeCellValue
          binding={envelopeBudget.totalBudgeted}
          type="financial"
        >
          {props => (
            <CellValueText
              {...props}
              style={figure}
              formatter={signedFormatter}
            />
          )}
        </EnvelopeCellValue>
      </TotalTile>

      <TotalTile label={<Trans>For next month</Trans>}>
        <EnvelopeCellValue
          binding={envelopeBudget.forNextMonth}
          type="financial"
        >
          {props => (
            <CellValueText
              {...props}
              style={figure}
              formatter={invertedSignedFormatter}
            />
          )}
        </EnvelopeCellValue>
      </TotalTile>
    </View>
  );
}
