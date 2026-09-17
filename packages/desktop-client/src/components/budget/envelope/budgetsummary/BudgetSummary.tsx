import React, { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import {
  SvgArrowButtonDown1,
  SvgArrowButtonUp1,
} from '@actual-app/components/icons/v2';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { css } from '@emotion/css';

import { useEnvelopeBudget } from '#components/budget/envelope/EnvelopeBudgetContext';
import { NotesButton } from '#components/NotesButton';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useUndo } from '#hooks/useUndo';

import { BudgetMonthMenu } from './BudgetMonthMenu';
import { ToBudget } from './ToBudget';
import { TotalsList } from './TotalsList';

// The card's content edge. Set so the label above the tiles lands on the same
// vertical as the category names in the table below it — the surface reads as
// one column of content, not a card parked on top of a table.
const CARD_PADDING = 18;

type EnvelopeMonthMenuProps = {
  month: string;
  onClose: () => void;
};

/**
 * The month's bulk actions (copy last month, averages, templates, clean-up).
 * Shared by the per-month summary card and the budget page's hero, so both
 * menus stay identical.
 */
export function EnvelopeMonthMenu({ month, onClose }: EnvelopeMonthMenuProps) {
  const locale = useLocale();
  const { t } = useTranslation();
  const { onBudgetAction } = useEnvelopeBudget();
  const { showUndoNotification } = useUndo();
  const displayMonth = monthUtils.format(month, "MMMM ''yy", locale);
  const onMenuClose = onClose;

  return (
    <BudgetMonthMenu
      onCopyLastMonthBudget={() => {
        onBudgetAction(month, 'copy-last');
        onMenuClose();
        showUndoNotification({
          message: t(
            "{{displayMonth}} budgets have all been set to last month's budgeted amounts.",
            { displayMonth },
          ),
        });
      }}
      onSetBudgetsToZero={() => {
        onBudgetAction(month, 'set-zero');
        onMenuClose();
        showUndoNotification({
          message: t('{{displayMonth}} budgets have all been set to zero.', {
            displayMonth,
          }),
        });
      }}
      onSetMonthsAverage={numberOfMonths => {
        onBudgetAction(month, `set-${numberOfMonths}-avg`);
        onMenuClose();
        showUndoNotification({
          message:
            numberOfMonths === 12
              ? t(
                  `${displayMonth} budgets have all been set to yearly average.`,
                )
              : t(
                  `${displayMonth} budgets have all been set to ${numberOfMonths} month average.`,
                ),
        });
      }}
      onCheckTemplates={() => {
        onBudgetAction(month, 'check-templates');
        onMenuClose();
      }}
      onApplyBudgetTemplates={() => {
        onBudgetAction(month, 'apply-goal-template');
        onMenuClose();
        showUndoNotification({
          message: t('{{displayMonth}} budget templates have been applied.', {
            displayMonth,
          }),
        });
      }}
      onOverwriteWithBudgetTemplates={() => {
        onBudgetAction(month, 'overwrite-goal-template');
        onMenuClose();
        showUndoNotification({
          message: t(
            '{{displayMonth}} budget templates have been overwritten.',
            { displayMonth },
          ),
        });
      }}
      onEndOfMonthCleanup={() => {
        onBudgetAction(month, 'cleanup-goal-template');
        onMenuClose();
        showUndoNotification({
          message: t(
            '{{displayMonth}} end-of-month cleanup templates have been applied.',
            { displayMonth },
          ),
        });
      }}
    />
  );
}

type BudgetSummaryProps = {
  month: string;
};
export const BudgetSummary = memo(({ month }: BudgetSummaryProps) => {
  const locale = useLocale();
  const {
    currentMonth,
    summaryCollapsed: collapsed,
    onBudgetAction,
    onToggleSummaryCollapse,
  } = useEnvelopeBudget();

  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);

  function onMenuOpen() {
    setMenuOpen(true);
  }

  function onMenuClose() {
    setMenuOpen(false);
  }

  const prevMonthName = monthUtils.format(
    monthUtils.prevMonth(month),
    'MMM',
    locale,
  );

  const ExpandOrCollapseIcon = collapsed
    ? SvgArrowButtonDown1
    : SvgArrowButtonUp1;

  const { t } = useTranslation();

  return (
    <View
      data-testid="budget-summary"
      data-month={month}
      style={{
        backgroundColor:
          month === currentMonth
            ? theme.budgetCurrentMonth
            : theme.budgetOtherMonth,
        // one edge signal: a hairline, not a cast shadow on a resting surface
        boxShadow: `inset 0 0 0 1px ${theme.tableBorder}`,
        borderRadius: 16,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 5,
        flex: 1,
        cursor: 'default',
        marginBottom: 5,
        overflow: 'hidden',
        '& .hover-visible': {
          opacity: 0,
          transition: 'opacity .25s',
        },
        '&:hover .hover-visible': {
          opacity: 1,
        },
      }}
    >
      <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
        <View
          style={{
            padding: `0 ${CARD_PADDING}px`,
            // the month names the card; its controls sit together at the far
            // end of the same line, out of the heading's way
            flexDirection: 'row',
            alignItems: 'center',
            ...(collapsed ? { margin: '12px 0' } : { marginTop: 20 }),
          }}
        >
          <div
            className={css([
              {
                textAlign: 'left',
                flexGrow: 1,
                ...styles.displayText,
                fontSize: 21,
                fontWeight: 600,
                textDecorationSkip: 'ink',
              },
              currentMonth === month && { color: theme.pageText },
            ])}
          >
            {monthUtils.format(month, 'MMMM', locale)}
          </div>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginRight: -8,
            }}
          >
            <Button
              variant="bare"
              aria-label={
                collapsed
                  ? t('Expand month summary')
                  : t('Collapse month summary')
              }
              className="hover-visible"
              onPress={onToggleSummaryCollapse}
            >
              <ExpandOrCollapseIcon
                width={13}
                height={13}
                // The margin is to make it the exact same size as the dots button
                style={{ color: theme.pageTextLight, margin: 1 }}
              />
            </Button>
            <View>
              <NotesButton
                id={`budget-${month}`}
                width={15}
                height={15}
                tooltipPosition="bottom right"
                defaultColor={theme.pageTextLight}
              />
            </View>
            <View style={{ userSelect: 'none', marginLeft: 2 }}>
              <Button
                ref={triggerRef}
                variant="bare"
                aria-label={t('Menu')}
                onPress={onMenuOpen}
              >
                <SvgDotsHorizontalTriple
                  width={15}
                  height={15}
                  style={{ color: theme.pageTextLight }}
                />
              </Button>

              <Popover
                triggerRef={triggerRef}
                isOpen={menuOpen}
                onOpenChange={onMenuClose}
              >
                <EnvelopeMonthMenu month={month} onClose={onMenuClose} />
              </Popover>
            </View>
          </View>
        </View>

        {collapsed ? (
          <View
            style={{
              // the collapsed answer keeps the card's left edge; centring it
              // left the figure floating away from everything above and below
              alignItems: 'flex-start',
              padding: `12px ${CARD_PADDING}px 16px`,
              justifyContent: 'space-between',
              backgroundColor: theme.budgetCurrentMonth,
              borderTop: '1px solid ' + theme.tableBorder,
            }}
          >
            <ToBudget
              prevMonthName={prevMonthName}
              month={month}
              onBudgetAction={onBudgetAction}
              isCollapsed
            />
          </View>
        ) : (
          <>
            <TotalsList
              prevMonthName={prevMonthName}
              style={{ padding: `0 ${CARD_PADDING}px`, marginTop: 14 }}
            />
            <View
              style={{ margin: '26px 0 24px', padding: `0 ${CARD_PADDING}px` }}
            >
              <ToBudget
                prevMonthName={prevMonthName}
                month={month}
                onBudgetAction={onBudgetAction}
              />
            </View>
          </>
        )}
      </SheetNameProvider>
    </View>
  );
});

BudgetSummary.displayName = 'EnvelopeBudgetSummary';
