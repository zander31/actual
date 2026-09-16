// Fork: the app's primary navigation, moved from the sidebar to the top.
//
// Sections are large text tabs — weight and colour carry the state, there is no
// pill, underline or icon. The net position is pinned to the right so it is
// never more than a glance away; every other balance lives on /balances.
import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';
import { NavLink } from 'react-router';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { BudgetName } from '#components/sidebar/BudgetName';
import { CellValue } from '#components/spreadsheet/CellValue';
import * as bindings from '#spreadsheet/bindings';

const TAB = {
  flexShrink: 0,
  fontSize: 20,
  fontWeight: 650,
  letterSpacing: '-0.03em',
  textDecoration: 'none',
  padding: '2px 0',
  transition: 'color .15s ease, opacity .12s ease',
  ':active': { opacity: 0.6 },
};

function Tab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? 'topnav-tab-active' : '')}
      style={({ isActive }) => ({
        ...TAB,
        color: isActive ? theme.pageText : theme.pageTextSubdued,
      })}
    >
      {children}
    </NavLink>
  );
}

export function TopNav() {
  return (
    <View
      style={{
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 900,
        backgroundColor: theme.pageBackground,
      }}
    >
      {/* BudgetName carries the sidebar's own 35px titlebar clearance and a
          23px tail; the clearance is what we want here, the tail is not. */}
      <View style={{ marginBottom: -23, flexShrink: 0 }}>
        <BudgetName />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 20,
          padding: '2px 24px 14px',
          flexShrink: 0,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 20,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            minWidth: 0,
            maskImage:
              'linear-gradient(to right, #000 calc(100% - 28px), transparent)',
            '::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Tab to="/budget">
            <Trans>Budget</Trans>
          </Tab>
          <Tab to="/balances">
            <Trans>Accounts</Trans>
          </Tab>
          <Tab to="/reports">
            <Trans>Reports</Trans>
          </Tab>
          <Tab to="/schedules">
            <Trans>Schedules</Trans>
          </Tab>
          {/* fork: custom pages */}
          <Tab to="/calendar">
            <Trans>Calendar</Trans>
          </Tab>
          <Tab to="/forecast">
            <Trans>Forecast</Trans>
          </Tab>
          <Tab to="/settings">
            <Trans>Settings</Trans>
          </Tab>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ alignItems: 'flex-end', flexShrink: 0, gap: 1 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '-0.008em',
              color: theme.pageTextSubdued,
            }}
          >
            <Trans>All accounts</Trans>
          </Text>
          <CellValue<'account', 'accounts-balance'>
            binding={bindings.allAccountBalance()}
            type="financial"
          >
            {({ value }) => (
              <Text
                style={{
                  ...styles.tnum,
                  fontSize: 21,
                  fontWeight: 600,
                  letterSpacing: '-0.028em',
                  color:
                    typeof value === 'number' && value < 0
                      ? theme.errorText
                      : theme.pageText,
                }}
              >
                {new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: 'USD',
                }).format(((value as number) ?? 0) / 100)}
              </Text>
            )}
          </CellValue>
        </View>
      </View>

      <View
        style={{ height: 1, backgroundColor: theme.tableBorder, flexShrink: 0 }}
      />
    </View>
  );
}
