// Fork: the app's primary navigation, moved from the sidebar to the top.
//
// Sections are large text tabs — weight and colour carry the state, there is no
// pill, underline or icon. The net position is pinned to the right so it is
// never more than a glance away; every other balance lives on /balances.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { Link } from '#components/common/Link';
import { BudgetName } from '#components/sidebar/BudgetName';
import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { useOffBudgetAccounts } from '#hooks/useOffBudgetAccounts';
import { useOnBudgetAccounts } from '#hooks/useOnBudgetAccounts';
import type { Binding } from '#spreadsheet';
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

/** One line of the breakdown: a name on the left, its balance on the right. */
function BreakdownLine({
  label,
  binding,
  strong,
}: {
  label: ReactNode;
  binding: Binding<
    'account',
    | 'balance'
    | 'accounts-balance'
    | 'onbudget-accounts-balance'
    | 'offbudget-accounts-balance'
  >;
  strong?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 24,
        padding: '5px 0',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: strong ? 600 : 500,
          letterSpacing: '-0.008em',
          color: strong ? theme.pageText : theme.pageTextLight,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 200,
        }}
      >
        {label}
      </Text>
      <CellValue binding={binding} type="financial">
        {props => (
          <CellValueText
            {...props}
            style={{
              ...styles.tnum,
              fontSize: strong ? 14 : 13,
              fontWeight: 600,
              letterSpacing: '-0.012em',
              whiteSpace: 'nowrap',
              color:
                typeof props.value === 'number' && props.value < 0
                  ? theme.errorText
                  : theme.pageText,
            }}
          />
        )}
      </CellValue>
    </View>
  );
}

function BreakdownGroup({
  label,
  total,
  accounts,
}: {
  label: ReactNode;
  total: Binding<
    'account',
    'onbudget-accounts-balance' | 'offbudget-accounts-balance'
  >;
  accounts: AccountEntity[];
}) {
  if (accounts.length === 0) return null;
  return (
    <View>
      <BreakdownLine label={label} binding={total} strong />
      {accounts.map(a => (
        <BreakdownLine
          key={a.id}
          label={a.name}
          binding={bindings.accountBalance(a.id)}
        />
      ))}
    </View>
  );
}

/** What the all-accounts figure is made of, account by account. */
function AccountsBreakdown() {
  const { data: onBudget = [] } = useOnBudgetAccounts();
  const { data: offBudget = [] } = useOffBudgetAccounts();
  return (
    <View style={{ padding: '6px 8px', minWidth: 260, gap: 8 }}>
      <BreakdownGroup
        label={<Trans>On budget</Trans>}
        total={bindings.onBudgetAccountBalance()}
        accounts={onBudget}
      />
      {onBudget.length > 0 && offBudget.length > 0 ? (
        <View style={{ height: 1, backgroundColor: theme.tableBorder }} />
      ) : null}
      <BreakdownGroup
        label={<Trans>Off budget</Trans>}
        total={bindings.offBudgetAccountBalance()}
        accounts={offBudget}
      />
    </View>
  );
}

/** Where the receipts app lives: the same box, its own port. */
function receiptsUrl(path: string) {
  return `${window.location.protocol}//${window.location.hostname}:8787${path}`;
}

/**
 * How many receipts are waiting in the receipts app's review queue. `null` when
 * it can't be asked — not running, or this device never opened the receipts
 * link, so its token cookie isn't here — and the chip simply stays away.
 */
function useWaitingReceipts() {
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const ask = () =>
      fetch(receiptsUrl('/count'), { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(body => {
          if (live) {
            setWaiting(typeof body?.waiting === 'number' ? body.waiting : null);
          }
        })
        .catch(() => live && setWaiting(null));
    void ask();
    // ponytail: poll a minute apart and on refocus; a push channel if that ever lags
    const askLater = () => void ask();
    const timer = window.setInterval(askLater, 60_000);
    window.addEventListener('focus', askLater);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', askLater);
    };
  }, []);
  return waiting;
}

/** The lime capsule: receipts waiting on a person. Opens the review queue. */
function ReceiptsChip() {
  const { t } = useTranslation();
  const waiting = useWaitingReceipts();
  if (!waiting) return null;
  return (
    <Link
      variant="external"
      linkColor="muted"
      to={receiptsUrl('/queue?show=review')}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        height: 32,
        padding: '0 14px',
        borderRadius: 999,
        flexShrink: 0,
        fontSize: 13,
        fontWeight: 650,
        letterSpacing: '-0.008em',
        whiteSpace: 'nowrap',
        textDecoration: 'none',
        backgroundColor: theme.highlightBackground,
        transition: 'background-color .14s ease, transform .12s ease',
        ':hover': { backgroundColor: theme.highlightBackgroundHover },
        ':active': { transform: 'scale(0.96)' },
        ':focus-visible': {
          outline: `2px solid ${theme.formInputBorderSelected}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      })}
    >
      <span style={{ color: theme.highlightText }}>
        {waiting === 1
          ? t('1 receipt waiting')
          : t('{{count}} receipts waiting', { count: waiting })}
      </span>
    </Link>
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

        <View style={{ alignSelf: 'center' }}>
          <ReceiptsChip />
        </View>

        <Tooltip
          content={<AccountsBreakdown />}
          placement="bottom end"
          offset={3}
        >
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
        </Tooltip>
      </View>

      <View
        style={{ height: 1, backgroundColor: theme.tableBorder, flexShrink: 0 }}
      />
    </View>
  );
}
