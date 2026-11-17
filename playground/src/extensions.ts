import { Scope } from '@epui/core';
import type { MotionScheme } from '@epui/motion';
import {
  enhanceDataTable,
  enhanceBanner,
  enhanceChip,
  enhanceButton,
  enhanceAppBar,
  enhanceIconButton,
  enhanceSelect,
} from '@epui/components';
import type { AppBarOptions } from '@epui/components';
import './extensions.css';
export function mountExtensions(parent: Scope, notify: (message: string) => void) {
  const scope = new Scope();
  parent.add(() => scope.dispose());
  const grid = document.querySelector('.catalog-grid')!;
  const articles = [...grid.querySelectorAll<HTMLElement>(':scope > [data-extension-card]')];
  scope.add(() => articles.forEach((article) => article.remove()));
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const updaters: ((scheme: MotionScheme) => void)[] = [];
  function own<T extends { destroy(): void }>(controller: T) {
    scope.add(() => controller.destroy());
    if ('update' in controller && typeof controller.update === 'function')
      updaters.push((scheme) =>
        (controller.update as (options: { motionScheme: MotionScheme }) => void)({
          motionScheme: scheme,
        }),
      );
    return controller;
  }
  interface Project {
    id: string;
    name: string;
    owner: string;
    status: string;
    updated: string;
    budget: number;
  }
  const rows: Project[] = Array.from({ length: 28 }, (_, index) => ({
    id: `P-${String(index + 1).padStart(3, '0')}`,
    name:
      [
        'Expressive foundations',
        'Motion exploration',
        'Color stories',
        'Native interactions',
        'Shape playground',
        'Accessible patterns',
        'Component library',
      ][index % 7]! + (index >= 7 ? ` / ${Math.floor(index / 7) + 1}` : ''),
    owner: ['Alex Morgan', 'Lin Chen', 'Sam Rivera', 'Noor Ali'][index % 4]!,
    status: ['In progress', 'Review', 'Complete'][index % 3]!,
    updated: `2026-11-${String(1 + (index % 14)).padStart(2, '0')}`,
    budget: 1200 + index * 375,
  }));
  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  const table = own(
    enhanceDataTable($('extension-table'), {
      label: 'Creative projects',
      rows,
      rowKey: (row) => row.id,
      selection: 'multiple',
      pageSize: 5,
      pageSizeOptions: [5, 10, 25],
      columns: [
        { key: 'name', label: 'Project', value: (row) => row.name, sortable: true },
        { key: 'owner', label: 'Owner', value: (row) => row.owner, sortable: true },
        {
          key: 'status',
          label: 'Status',
          value: (row) => row.status,
          sortable: true,
          render: (row) => {
            const tag = document.createElement('span');
            tag.className = 'extension-status-pill';
            tag.dataset.status = row.status.toLowerCase().replaceAll(' ', '-');
            tag.textContent = row.status;
            return tag;
          },
        },
        {
          key: 'budget',
          label: 'Budget',
          value: (row) => row.budget,
          numeric: true,
          sortable: true,
          render: (row) => currency.format(row.budget),
        },
        { key: 'updated', label: 'Updated', value: (row) => row.updated, sortable: true },
      ],
    }),
  );
  const filter = own(
    enhanceSelect($<HTMLSelectElement>('extension-table-filter'), { label: 'Project status' }),
  );
  scope.listen(filter.element, 'change', () => {
    const value = filter.value;
    table.update({ filter: (row) => value === 'all' || row.status === value, pageIndex: 0 });
  });
  const clear = own(
    enhanceButton($<HTMLButtonElement>('extension-clear-selection'), { variant: 'text' }),
  );
  scope.listen(clear.element, 'click', () => table.setSelectedKeys([], { notify: true }));
  scope.listen(table.element, 'eui-selection-change', (event) => {
    $('extension-table-status').textContent =
      `Selected: ${(event as CustomEvent<{ keys: string[] }>).detail.keys.join(', ') || 'none'}`;
  });
  scope.listen(table.element, 'eui-sort-change', (event) => {
    const sort = (event as CustomEvent<{ sort: { key: string; direction: string } | null }>).detail
      .sort;
    $('extension-table-status').textContent = sort
      ? `Sorted by ${sort.key} · ${sort.direction}`
      : 'Original order restored.';
  });
  own(enhanceChip($<HTMLButtonElement>('extension-assist-calendar'), { variant: 'assist' }));
  own(
    enhanceChip($<HTMLButtonElement>('extension-assist-directions'), {
      variant: 'assist',
      elevated: true,
    }),
  );
  own(enhanceChip($<HTMLButtonElement>('extension-assist-disabled'), { variant: 'assist' }));
  scope.listen($('extension-assist-calendar'), 'click', () => {
    $('extension-assist-status').textContent = 'Calendar action selected.';
    notify('Calendar action · demo');
  });
  scope.listen($('extension-assist-directions'), 'click', () => {
    $('extension-assist-status').textContent = 'Directions action selected.';
    notify('Directions action · demo');
  });
  const banner = own(
    enhanceBanner($('extension-banner'), {
      message: 'You’re working offline. Changes will sync when you reconnect.',
      icon: '↻',
      label: '连接状态',
      primaryAction: {
        label: 'Retry',
        onClick: () => {
          banner.update({ message: 'You’re connected. Your work is up to date.', icon: '✓' });
          notify('Connection restored · demo');
        },
      },
      secondaryAction: { label: 'Dismiss', dismiss: true },
    }),
  );
  const showBanner = own(
    enhanceButton($<HTMLButtonElement>('extension-show-banner'), { variant: 'tonal' }),
  );
  scope.listen(showBanner.element, 'click', () => {
    banner.update({
      message: 'You’re working offline. Changes will sync when you reconnect.',
      icon: '↻',
    });
    banner.open();
  });
  for (const button of $('extension-bar').querySelectorAll<HTMLButtonElement>('button'))
    own(enhanceIconButton(button, { variant: 'standard' }));
  const bar = own(
    enhanceAppBar($('extension-bar'), {
      variant: 'medium-flex',
      subtitle: 'A new perspective, every day.',
      scrollBehavior: 'collapse',
      scrollTarget: $('extension-bar-scroll'),
    }),
  );
  const variant = own(
      enhanceSelect($<HTMLSelectElement>('extension-bar-variant'), { label: 'App bar variant' }),
    ),
    align = own(
      enhanceSelect($<HTMLSelectElement>('extension-bar-align'), { label: 'Title alignment' }),
    );
  scope.listen(variant.element, 'change', () => {
    const value = variant.value as NonNullable<AppBarOptions['variant']>;
    $('extension-bar-scroll').scrollTop = 0;
    if (value === 'center-aligned') align.setValue('center');
    bar.update({
      variant: value,
      titleAlignment: align.value as 'start' | 'center',
      subtitle: value.includes('flex') ? 'A new perspective, every day.' : '',
    });
  });
  scope.listen(align.element, 'change', () =>
    bar.update({ titleAlignment: align.value as 'start' | 'center' }),
  );
  return {
    setMotionScheme(scheme: MotionScheme) {
      for (const update of updaters) update(scheme);
    },
    destroy() {
      scope.dispose();
    },
  };
}
