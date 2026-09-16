// Fork: the accounts overview. The sidebar used to carry every balance in a
// column two words wide; here they get the room to be read — the net position
// as the page's figure, then each account as a ruled row with its balance
// right-aligned against it.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { Page } from '#components/Page';
import { CellValue } from '#components/spreadsheet/CellValue';
import { useOffBudgetAccounts } from '#hooks/useOffBudgetAccounts';
import { useOnBudgetAccounts } from '#hooks/useOnBudgetAccounts';
import type { Binding, SheetFields, SheetNames } from '#spreadsheet';
import * as bindings from '#spreadsheet/bindings';

import { columnLabel, HeroNumber, Rule, sectionLabel } from './primitives';

/** A balance, always tabular, red only when the money is actually negative. */
function Balance<
  SheetName extends SheetNames,
  FieldName extends SheetFields<SheetName>,
>({
  binding,
  size = 17,
  weight = 600,
}: {
  binding: Binding<SheetName, FieldName>;
  size?: number;
  weight?: number;
}) {
  return (
    <CellValue binding={binding} type="financial">
      {({ value }) => (
        <Text
          style={{
            ...styles.tnum,
            fontSize: size,
            fontWeight: weight,
            letterSpacing: size >= 30 ? '-0.035em' : '-0.02em',
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
  );
}

function AccountRow<
  SheetName extends SheetNames,
  FieldName extends SheetFields<SheetName>,
>({
  name,
  to,
  binding,
  note,
}: {
  name: string;
  to: string;
  binding: Binding<SheetName, FieldName>;
  note?: ReactNode;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '15px 4px',
        textDecoration: 'none',
        color: 'inherit',
        borderBottom: `1px solid ${theme.tableBorder}`,
      }}
      className="balances-row"
    >
      <View style={{ gap: 2, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '-0.018em',
            color: theme.pageText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Text>
        {note ? <Text style={{ ...columnLabel }}>{note}</Text> : null}
      </View>
      <Balance<SheetName, FieldName> binding={binding} />
    </Link>
  );
}

function Group<
  SheetName extends SheetNames,
  FieldName extends SheetFields<SheetName>,
>({
  title,
  total,
  children,
}: {
  title: string;
  total: Binding<SheetName, FieldName>;
  children: ReactNode;
}) {
  return (
    <View style={{ marginTop: 34, flexShrink: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 10,
        }}
      >
        <Text style={{ ...sectionLabel, color: theme.pageText }}>{title}</Text>
        <Balance<SheetName, FieldName> binding={total} size={17} weight={600} />
      </View>
      <Rule />
      {children}
    </View>
  );
}

export function BalancesPage() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const { data: onBudget = [] } = useOnBudgetAccounts();
  const { data: offBudget = [] } = useOffBudgetAccounts();

  const row = (account: AccountEntity) => (
    <AccountRow<'account', 'balance'>
      key={account.id}
      name={account.name}
      to={`/accounts/${account.id}`}
      binding={bindings.accountBalance(account.id)}
      note={account.bank ? t('Bank connected') : undefined}
    />
  );

  return (
    <Page header={isNarrowWidth ? t('Accounts') : null}>
      <View style={{ maxWidth: 640, flexShrink: 0, gap: 6 }}>
        <HeroNumber>
          <CellValue<'account', 'accounts-balance'>
            binding={bindings.allAccountBalance()}
            type="financial"
          >
            {({ value }) =>
              new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: 'USD',
              }).format(((value as number) ?? 0) / 100)
            }
          </CellValue>
        </HeroNumber>
        <Link
          to="/accounts"
          style={{
            ...columnLabel,
            fontSize: 15,
            fontWeight: 500,
            color: theme.pageTextLink,
            textDecoration: 'none',
            alignSelf: 'flex-start',
          }}
        >
          {t('All accounts · view every transaction')}
        </Link>
      </View>

      <View style={{ maxWidth: 640, flexShrink: 0 }}>
        {onBudget.length > 0 && (
          <Group<'account', 'onbudget-accounts-balance'>
            title={t('On budget')}
            total={bindings.onBudgetAccountBalance()}
          >
            {onBudget.map(row)}
          </Group>
        )}
        {offBudget.length > 0 && (
          <Group<'account', 'offbudget-accounts-balance'>
            title={t('Off budget')}
            total={bindings.offBudgetAccountBalance()}
          >
            {offBudget.map(row)}
          </Group>
        )}
      </View>
    </Page>
  );
}
