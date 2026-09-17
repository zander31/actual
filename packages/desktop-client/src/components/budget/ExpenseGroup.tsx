// @ts-strict-ignore
import React from 'react';
import type { ComponentProps } from 'react';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import { DropHighlight, useDraggable, useDroppable } from '#components/sort';
import type {
  DragState,
  OnDragChangeCallback,
  OnDropCallback,
} from '#components/sort';
import { Row, ROW_HEIGHT } from '#components/table';
import { useDragRef } from '#hooks/useDragRef';

import {
  INSTRUMENT_GROUP_ROW_HEIGHT,
  INSTRUMENT_ROW_HEIGHT,
  useIsInstrumentMonth,
} from './MonthsContext';
import { RenderMonths } from './RenderMonths';
import { SidebarGroup } from './SidebarGroup';

import { useBudgetComponents } from '.';

type ExpenseGroupProps = {
  group: ComponentProps<typeof SidebarGroup>['group'];
  collapsed: boolean;
  editingCell: { id: string; cell: string } | null;
  dragState: DragState<CategoryEntity> | DragState<CategoryGroupEntity> | null;
  onEditName?: ComponentProps<typeof SidebarGroup>['onEdit'];
  onSave?: ComponentProps<typeof SidebarGroup>['onSave'];
  onDelete?: ComponentProps<typeof SidebarGroup>['onDelete'];
  onApplyBudgetTemplatesInGroup?: ComponentProps<
    typeof SidebarGroup
  >['onApplyBudgetTemplatesInGroup'];
  onSortCategories?: ComponentProps<typeof SidebarGroup>['onSortCategories'];
  onDragChange: OnDragChangeCallback<
    ComponentProps<typeof SidebarGroup>['group']
  >;
  onReorderGroup: OnDropCallback;
  onReorderCategory: OnDropCallback;
  onToggleCollapse?: ComponentProps<typeof SidebarGroup>['onToggleCollapse'];
  onShowNewCategory?: ComponentProps<typeof SidebarGroup>['onShowNewCategory'];
};

export function ExpenseGroup({
  group,
  collapsed,
  editingCell,
  dragState,
  onEditName,
  onSave,
  onDelete,
  onApplyBudgetTemplatesInGroup,
  onSortCategories,
  onDragChange,
  onReorderGroup,
  onReorderCategory,
  onToggleCollapse,
  onShowNewCategory,
}: ExpenseGroupProps) {
  const dragging = dragState && dragState.item === group;

  const { dragRef } = useDraggable({
    type: 'group',
    onDragChange,
    item: group,
    canDrag: editingCell === null,
  });
  const handleDragRef = useDragRef(dragRef);

  const { dropRef, dropPos } = useDroppable({
    types: 'group',
    id: group.id,
    onDrop: onReorderGroup,
  });

  const { dropRef: catDropRef, dropPos: catDropPos } = useDroppable({
    types: 'category',
    id: group.id,
    onDrop: onReorderCategory,
    onLongHover: () => {
      if (collapsed) {
        onToggleCollapse(group.id);
      }
    },
  });

  const { ExpenseGroupComponent: MonthComponent } = useBudgetComponents();
  const isInstrument = useIsInstrumentMonth();
  const groupRowHeight = isInstrument
    ? INSTRUMENT_GROUP_ROW_HEIGHT
    : ROW_HEIGHT;
  const categoryRowHeight = isInstrument ? INSTRUMENT_ROW_HEIGHT : ROW_HEIGHT;

  return (
    <Row
      collapsed
      height={isInstrument ? INSTRUMENT_GROUP_ROW_HEIGHT : undefined}
      style={{
        fontWeight: 600,
        opacity: group.hidden ? 0.33 : undefined,
        backgroundColor: theme.budgetHeaderCurrentMonth, //use budget colors
      }}
    >
      {dragState && !dragState.preview && dragState.type === 'group' && (
        <View
          innerRef={dropRef}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: collapsed
              ? groupRowHeight - 1
              : groupRowHeight -
                1 +
                group.categories.length * (categoryRowHeight - 1) +
                1,
            zIndex: 10000,
          }}
        >
          <DropHighlight pos={dropPos} offset={{ top: 1 }} />
        </View>
      )}

      <DropHighlight pos={catDropPos} offset={{ top: 1 }} />

      <View
        innerRef={catDropRef}
        style={{
          flex: 1,
          flexDirection: 'row',
          opacity: dragging && !dragState.preview ? 0.3 : 1,
        }}
      >
        <SidebarGroup
          innerRef={handleDragRef}
          group={group}
          editing={
            editingCell &&
            editingCell.cell === 'name' &&
            editingCell.id === group.id
          }
          dragPreview={dragging && dragState.preview}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onEdit={onEditName}
          onSave={onSave}
          onDelete={onDelete}
          onApplyBudgetTemplatesInGroup={onApplyBudgetTemplatesInGroup}
          onSortCategories={onSortCategories}
          onShowNewCategory={onShowNewCategory}
        />
        <RenderMonths style={isInstrument ? { borderLeft: 0 } : undefined}>
          {({ month }) => <MonthComponent month={month} group={group} />}
        </RenderMonths>
      </View>
    </Row>
  );
}
