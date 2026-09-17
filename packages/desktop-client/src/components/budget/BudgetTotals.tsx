import React, { memo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import {
  SvgArrowButtonLeft1,
  SvgArrowButtonRight1,
  SvgArrowButtonSingleLeft1,
} from '@actual-app/components/icons/v2';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { useGlobalPref } from '#hooks/useGlobalPref';

import { useIsInstrumentMonth } from './MonthsContext';
import { RenderMonths } from './RenderMonths';
import { getCategoryColumnWidth, getScrollbarWidth } from './util';

import { useBudgetComponents } from '.';

type BudgetTotalsProps = {
  /** Sit inside the rows' scroll and stick to its top. */
  sticky?: boolean;
  toggleHiddenCategories: () => void;
  expandAllCategories: () => void;
  collapseAllCategories: () => void;
};

export const BudgetTotals = memo(function BudgetTotals({
  sticky = false,
  toggleHiddenCategories,
  expandAllCategories,
  collapseAllCategories,
}: BudgetTotalsProps) {
  const { t } = useTranslation();
  const [categoryExpandedStatePref, setCategoryExpandedStatePref] =
    useGlobalPref('categoryExpandedState');
  const categoryExpandedState = categoryExpandedStatePref ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);

  const cycleExpandedState = () => {
    const nextState = (categoryExpandedState + 1) % 3;
    setCategoryExpandedStatePref(nextState);
  };

  const getExpandStateLabel = () => {
    switch (categoryExpandedState) {
      case 0:
        return t('Expand');
      case 1:
        return t('Fully Expand');
      case 2:
        return t('Collapse');
      default:
        return t('Expand');
    }
  };

  const { BudgetTotalsComponent: MonthComponent } = useBudgetComponents();
  const isInstrument = useIsInstrumentMonth();

  return (
    <View
      data-testid="budget-totals"
      style={{
        backgroundColor: theme.budgetCurrentMonth, //use budget colors, not generic table colors
        flexDirection: 'row',
        flexShrink: 0,
        // one edge signal: the hairline below carries it, so no cast shadow on
        // a surface that never leaves the screen
        ...(sticky
          ? {
              // inside the scroll the rows already share its edges; the
              // column labels ride along the top once the hero has gone
              position: 'sticky',
              top: 0,
              zIndex: 150,
            }
          : {
              marginLeft: 5,
              marginRight: 5 + getScrollbarWidth(),
              borderRadius: '4px 4px 0 0',
            }),
        borderBottom: '1px solid ' + theme.tableBorder,
        '& .hover-visible': {
          opacity: 0,
          transition: 'opacity .25s',
        },
        '&:hover .hover-visible': {
          opacity: 1,
        },
      }}
    >
      <View
        style={{
          width: getCategoryColumnWidth(categoryExpandedState),
          color: theme.tableHeaderText,
          justifyContent: 'center',
          // the label starts on the same left edge as the category names below
          // it and as the summary above; the column's two chrome controls sit
          // together on the right rather than pushing the heading off it
          paddingLeft: 18,
          paddingRight: 5,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <View
          style={{
            flexGrow: '1',
            ...(sticky && {
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '-0.006em',
              color: theme.pageTextSubdued,
            }),
          }}
        >
          {sticky ? <Trans>Envelope</Trans> : <Trans>Category</Trans>}
        </View>
        <Button
          variant="bare"
          aria-label={getExpandStateLabel()}
          onPress={cycleExpandedState}
          className="hover-visible"
          style={{
            color: 'currentColor',
            padding: 3,
            marginRight: 8,
          }}
        >
          {categoryExpandedState === 0 ? (
            <SvgArrowButtonSingleLeft1
              style={{
                width: 12,
                height: 12,
              }}
            />
          ) : categoryExpandedState === 1 ? (
            <SvgArrowButtonLeft1
              style={{
                width: 12,
                height: 12,
              }}
            />
          ) : (
            <SvgArrowButtonRight1
              style={{
                width: 12,
                height: 12,
              }}
            />
          )}
        </Button>
        <Button
          ref={triggerRef}
          variant="bare"
          aria-label={t('Menu')}
          onPress={() => setMenuOpen(true)}
          style={{ color: 'currentColor', padding: 3 }}
        >
          <SvgDotsHorizontalTriple
            width={15}
            height={15}
            style={{ color: theme.tableHeaderText }}
          />
        </Button>

        <Popover
          triggerRef={triggerRef}
          isOpen={menuOpen}
          onOpenChange={() => setMenuOpen(false)}
          style={{ width: 200 }}
        >
          <Menu
            onMenuSelect={type => {
              if (type === 'toggle-visibility') {
                toggleHiddenCategories();
              } else if (type === 'expandAllCategories') {
                expandAllCategories();
              } else if (type === 'collapseAllCategories') {
                collapseAllCategories();
              }
              setMenuOpen(false);
            }}
            items={[
              {
                name: 'toggle-visibility',
                text: t('Toggle hidden categories'),
              },
              {
                name: 'expandAllCategories',
                text: t('Expand all'),
              },
              {
                name: 'collapseAllCategories',
                text: t('Collapse all'),
              },
            ]}
          />
        </Popover>
      </View>
      <RenderMonths style={isInstrument ? { borderLeft: 0 } : undefined}>
        <MonthComponent />
      </RenderMonths>
    </View>
  );
});
