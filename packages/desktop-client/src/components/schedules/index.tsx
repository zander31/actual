import React, { useCallback, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { q } from '@actual-app/core/shared/query';
import type { ScheduleEntity } from '@actual-app/core/types/models';

import { Search } from '#components/common/Search';
import {
  detectDrift,
  DriftBanner,
  matchesScheduleFilter,
  SchedulesHero,
  useScheduleCharges,
} from '#components/custom/SchedulesInstrument';
import type {
  Drift,
  ScheduleFilter,
} from '#components/custom/SchedulesInstrument';
import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { Page } from '#components/Page';
import { useSchedules } from '#hooks/useSchedules';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

import { SchedulesTable } from './SchedulesTable';
import type { ScheduleItemAction } from './SchedulesTable';

export function Schedules() {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<ScheduleFilter>('all');
  const { isNarrowWidth } = useResponsive();

  const onEdit = useCallback(
    (id: ScheduleEntity['id']) => {
      dispatch(
        pushModal({ modal: { name: 'schedule-edit', options: { id } } }),
      );
    },
    [dispatch],
  );

  const onAdd = useCallback(() => {
    dispatch(pushModal({ modal: { name: 'schedule-edit', options: {} } }));
  }, [dispatch]);

  const onDiscover = useCallback(() => {
    dispatch(pushModal({ modal: { name: 'schedules-discover' } }));
  }, [dispatch]);

  const onChangeUpcomingLength = useCallback(() => {
    dispatch(pushModal({ modal: { name: 'schedules-upcoming-length' } }));
  }, [dispatch]);

  const onAction = useCallback(
    async (name: ScheduleItemAction, id: ScheduleEntity['id']) => {
      switch (name) {
        case 'post-transaction':
          await send('schedule/post-transaction', { id });
          break;
        case 'post-transaction-today':
          await send('schedule/post-transaction', { id, today: true });
          break;
        case 'skip':
          await send('schedule/skip-next-date', { id });
          break;
        case 'complete':
          await send('schedule/update', {
            schedule: { id, completed: true },
          });
          break;
        case 'restart':
          await send('schedule/update', {
            schedule: { id, completed: false },
            resetNextDate: true,
          });
          break;
        case 'delete':
          await send('schedule/delete', { id });
          break;
        default:
          throw new Error(`Unknown action: ${String(name)}`);
      }
    },
    [],
  );

  const schedulesQuery = useMemo(() => q('schedules').select('*'), []);
  const {
    isLoading: isSchedulesLoading,
    schedules,
    statuses,
  } = useSchedules({ query: schedulesQuery });

  // Fork: each schedule's linked charges, and which ones have drifted.
  const charges = useScheduleCharges();
  const drifts = useMemo(() => {
    const out = new Map<string, Drift>();
    for (const s of schedules) {
      const drift = detectDrift(s, charges.get(s.id));
      if (drift) out.set(s.id, drift);
    }
    return out;
  }, [schedules, charges]);
  const biggestDrift = [...drifts.values()].sort(
    (a, b) => Math.abs(b.change) - Math.abs(a.change),
  )[0];
  const driftSchedule = biggestDrift
    ? schedules.find(s => s.id === biggestDrift.scheduleId)
    : undefined;
  const activeTab = tab === 'drifting' && drifts.size === 0 ? 'all' : tab;
  const visibleSchedules = useMemo(
    () =>
      activeTab === 'all'
        ? schedules
        : schedules.filter(s =>
            matchesScheduleFilter(
              activeTab,
              statuses.get(s.id),
              drifts.has(s.id),
            ),
          ),
    [activeTab, schedules, statuses, drifts],
  );

  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <Page header={isNarrowWidth ? t('Schedules') : null}>
        <View style={{ paddingTop: 12, flexShrink: 0 }}>
          <SchedulesHero
            schedules={schedules}
            statuses={statuses}
            charges={charges}
            filter={activeTab}
            onFilter={setTab}
            showDrifting={drifts.size > 0}
            onAdd={onAdd}
            onDiscover={onDiscover}
            search={
              <Search
                placeholder={t('Filter schedules…')}
                value={filter}
                onChange={setFilter}
              />
            }
          />
          {biggestDrift && driftSchedule ? (
            <DriftBanner
              schedule={driftSchedule}
              drift={biggestDrift}
              onUpdate={() => onEdit(driftSchedule.id)}
            />
          ) : null}
        </View>

        <SchedulesTable
          isLoading={isSchedulesLoading}
          schedules={visibleSchedules}
          charges={charges}
          drifts={drifts}
          filter={filter}
          statuses={statuses}
          allowCompleted
          onSelect={onEdit}
          onAction={onAction}
          style={{ backgroundColor: theme.tableBackground }}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            margin: '20px 0 60px',
            flexShrink: 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: '1em',
            }}
          >
            <Button onPress={onDiscover}>
              <Trans>Find schedules</Trans>
            </Button>
            <Button onPress={onChangeUpcomingLength}>
              <Trans>Change upcoming length</Trans>
            </Button>
          </View>
        </View>
      </Page>
    </ErrorBoundary>
  );
}
