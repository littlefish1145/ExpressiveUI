import { Scope } from '@expressive-ui/core';
import type { MotionScheme } from '@expressive-ui/motion';
import { mount } from './shared.js';
import { emit, uniqueId } from './collection.js';
import { enhanceCheckbox } from './checkbox.js';
import { enhanceRadio } from './radio.js';
import { enhanceIconButton } from './icon-button.js';
import { enhanceSelect } from './select.js';
import { interactive } from './interactive.js';
import { createSpring, motionPreset } from '@expressive-ui/motion';
export interface DataTableColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => string | number | boolean | Date | null | undefined;
  numeric?: boolean;
  sortable?: boolean;
  compare?: (a: Row, b: Row) => number;
  render?: (row: Row) => Node | string;
}
export interface DataTableSort {
  key: string;
  direction: 'ascending' | 'descending';
}
export interface DataTableOptions<Row> {
  rows: readonly Row[];
  columns: readonly DataTableColumn<Row>[];
  rowKey: (row: Row) => string | number;
  label: string;
  selection?: 'none' | 'single' | 'multiple';
  isRowSelectable?: (row: Row) => boolean;
  selectedKeys?: readonly (string | number)[];
  selectionName?: string;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  pageIndex?: number;
  sort?: DataTableSort | null;
  filter?: (row: Row) => boolean;
  locale?: string;
  emptyText?: string;
  motionScheme?: MotionScheme;
}
/** Semantic table with client-side stable sorting, page selection and pagination. */
export function enhanceDataTable<Row>(host: HTMLElement, initial: DataTableOptions<Row>) {
  function validate(options: DataTableOptions<Row>) {
    if (
      !options.columns.length ||
      new Set(options.columns.map((column) => column.key)).size !== options.columns.length
    )
      throw new TypeError('Table columns require unique keys');
    const keys = options.rows.map((row) => String(options.rowKey(row)));
    if (new Set(keys).size !== keys.length) throw new TypeError('Table rows require unique keys');
    if (
      !Number.isInteger(options.pageSize ?? 10) ||
      (options.pageSize ?? 10) < 1 ||
      (options.pageSize ?? 10) > 500
    )
      throw new RangeError('pageSize must be an integer from 1 to 500');
    if (options.pageSizeOptions?.some((size) => !Number.isInteger(size) || size < 1 || size > 500))
      throw new RangeError('Invalid page size option');
    if (
      options.pageIndex !== undefined &&
      (!Number.isInteger(options.pageIndex) || options.pageIndex < 0)
    )
      throw new RangeError('pageIndex must be a nonnegative integer');
    if (
      options.sort &&
      !options.columns.some((column) => column.key === options.sort!.key && column.sortable)
    )
      throw new TypeError('Unknown sortable column');
  }
  validate(initial);
  const scope = mount(host, 'eui-data-table', ['data-selected', 'style']);
  const original = [...host.childNodes];
  host.replaceChildren();
  scope.add(() => host.replaceChildren(...original));
  let options = { ...initial },
    selected = new Set((initial.selectedKeys ?? []).map(String)),
    sort = initial.sort ?? null,
    pageIndex = Math.max(0, Math.trunc(initial.pageIndex ?? 0)),
    pageSize = initial.pageSize ?? 10;
  let view: { row: Row; key: string; index: number }[] = [],
    visible: typeof view = [],
    pageScope = new Scope(),
    headerScope = new Scope();
  scope.add(() => {
    pageScope.dispose();
    headerScope.dispose();
  });
  const toolbar = document.createElement('div');
  toolbar.className = 'eui-data-table-toolbar';
  const heading = document.createElement('h3'),
    status = document.createElement('span');
  heading.className = 'eui-data-table-title';
  status.className = 'eui-data-table-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  toolbar.append(heading, status);
  const scroll = document.createElement('div');
  scroll.className = 'eui-data-table-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', initial.label);
  const table = document.createElement('table'),
    caption = document.createElement('caption'),
    thead = document.createElement('thead'),
    tbody = document.createElement('tbody');
  caption.className = 'eui-visually-hidden';
  table.append(caption, thead, tbody);
  scroll.append(table);
  const footer = document.createElement('div');
  footer.className = 'eui-data-table-pagination';
  const pageSizeLabel = document.createElement('label'),
    sizeSelect = document.createElement('select');
  pageSizeLabel.textContent = '每页行数 ';
  sizeSelect.setAttribute('aria-label', '每页行数');
  pageSizeLabel.append(sizeSelect);
  const range = document.createElement('span');
  range.className = 'eui-data-table-range';
  const first = document.createElement('button'),
    previous = document.createElement('button'),
    next = document.createElement('button'),
    last = document.createElement('button');
  for (const [button, text, label] of [
    [first, '⇤', '第一页'],
    [previous, '‹', '上一页'],
    [next, '›', '下一页'],
    [last, '⇥', '最后一页'],
  ] as const) {
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', label);
  }
  footer.append(pageSizeLabel, range, first, previous, next, last);
  host.append(toolbar, scroll, footer);
  const pageButtons = [first, previous, next, last].map((button) =>
    enhanceIconButton(button, { size: 'sm', motionScheme: options.motionScheme ?? 'expressive' }),
  );
  for (const button of pageButtons) scope.add(() => button.destroy());
  function fillSizes() {
    const values = [...new Set([...(options.pageSizeOptions ?? [5, 10, 25, 50]), pageSize])].sort(
      (a, b) => a - b,
    );
    sizeSelect.replaceChildren(
      ...values.map((size) => {
        const option = document.createElement('option');
        option.value = String(size);
        option.textContent = String(size);
        return option;
      }),
    );
    sizeSelect.value = String(pageSize);
  }
  fillSizes();
  const sizeController = enhanceSelect(sizeSelect, {
    label: '每页行数',
    variant: 'text',
    motionScheme: options.motionScheme ?? 'expressive',
  });
  scope.add(() => sizeController.destroy());
  const rowControls = new Map<
    string,
    { input: HTMLInputElement; refresh: () => void; row: HTMLTableRowElement }
  >();
  const sortAnimations = new Map<string, ReturnType<typeof createSpring>>();
  let headerControl: ReturnType<typeof enhanceCheckbox> | undefined;
  const groupName = uniqueId('eui-table-selection');
  function selectable(row: Row) {
    return options.isRowSelectable?.(row) !== false;
  }
  function paintSelection() {
    const eligible = visible.filter((item) => selectable(item.row)),
      count = eligible.filter((item) => selected.has(item.key)).length;
    headerControl?.setState(
      count === 0 ? 'unchecked' : count === eligible.length ? 'checked' : 'mixed',
    );
    if (headerControl) {
      headerControl.element.disabled = eligible.length === 0;
      headerControl.refresh();
    }
    for (const [key, control] of rowControls) {
      control.input.checked = selected.has(key);
      control.row.dataset.selected = String(selected.has(key));
      control.refresh();
    }
    host.dataset.selected = String(selected.size > 0);
    status.textContent = selected.size ? `已选择 ${selected.size} 项` : `${view.length} 项`;
  }
  function selectionChanged() {
    paintSelection();
    emit(host, 'eui-selection-change', {
      keys: [...selected],
      rows: options.rows.filter((row) => selected.has(String(options.rowKey(row)))),
    });
  }
  function buildHeader() {
    headerScope.dispose();
    headerScope = new Scope();
    headerControl = undefined;
    sortAnimations.clear();
    thead.replaceChildren();
    const tr = document.createElement('tr');
    thead.append(tr);
    if (options.selection && options.selection !== 'none') {
      const th = document.createElement('th');
      th.scope = 'col';
      th.className = 'eui-data-table-choice';
      tr.append(th);
      if (options.selection === 'multiple') {
        const wrapper = document.createElement('span'),
          input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('aria-label', '选择本页所有可选行');
        wrapper.append(input);
        th.append(wrapper);
        headerControl = enhanceCheckbox(input, {
          motionScheme: options.motionScheme ?? 'expressive',
        });
        headerScope.add(() => headerControl?.destroy());
        headerScope.listen(input, 'change', () => {
          for (const item of visible)
            if (selectable(item.row)) {
              if (input.checked) selected.add(item.key);
              else selected.delete(item.key);
            }
          selectionChanged();
        });
      } else th.setAttribute('aria-label', '选择行');
    }
    for (const column of options.columns) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.dataset.key = column.key;
      th.dataset.numeric = String(column.numeric ?? false);
      tr.append(th);
      if (column.sortable) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'eui-data-table-sort';
        button.append(document.createTextNode(column.label));
        const icon = document.createElement('span');
        icon.className = 'eui-data-table-sort-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML =
          '<svg viewBox="0 0 24 24" width="18" height="18" focusable="false"><path d="M12 4v16m-5-5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        button.append(icon);
        const initialAngle = sort?.key === column.key && sort.direction === 'descending' ? 0 : 180;
        icon.style.transform = `rotate(${initialAngle}deg)`;
        const rotation = createSpring(
          initialAngle,
          (angle) => (icon.style.transform = `rotate(${angle}deg)`),
          motionPreset(options.motionScheme, 'fast.effects'),
        );
        sortAnimations.set(column.key, rotation);
        headerScope.add(() => rotation.destroy());
        th.append(button);
        interactive(button, headerScope, options.motionScheme);
        headerScope.listen(button, 'click', () =>
          setSort(
            sort?.key !== column.key
              ? { key: column.key, direction: 'ascending' }
              : sort.direction === 'ascending'
                ? { key: column.key, direction: 'descending' }
                : null,
            true,
          ),
        );
      } else th.textContent = column.label;
    }
  }
  function rebuildView() {
    const keys = new Set(options.rows.map((row) => String(options.rowKey(row))));
    selected = new Set([...selected].filter((key) => keys.has(key)));
    if (options.selection === 'single' && selected.size > 1)
      selected = new Set([...selected].slice(0, 1));
    view = options.rows
      .map((row, index) => ({ row, key: String(options.rowKey(row)), index }))
      .filter((item) => !options.filter || options.filter(item.row));
    const column = options.columns.find((column) => column.key === sort?.key);
    if (sort && column) {
      const collator = new Intl.Collator(options.locale ?? 'zh-CN', {
          numeric: true,
          sensitivity: 'base',
        }),
        direction = sort.direction === 'ascending' ? 1 : -1;
      view.sort((a, b) => {
        let result: number;
        if (column.compare) result = column.compare(a.row, b.row);
        else {
          const x = column.value(a.row),
            y = column.value(b.row);
          result =
            x == null
              ? y == null
                ? 0
                : 1
              : y == null
                ? -1
                : typeof x === 'number' && typeof y === 'number'
                  ? x - y
                  : x instanceof Date && y instanceof Date
                    ? x.getTime() - y.getTime()
                    : collator.compare(String(x), String(y));
        }
        return direction * (Number.isFinite(result) ? result : 0) || a.index - b.index;
      });
    }
  }
  function renderPage() {
    if (scope.disposed) return;
    pageScope.dispose();
    pageScope = new Scope();
    rowControls.clear();
    tbody.replaceChildren();
    const pages = Math.max(1, Math.ceil(view.length / pageSize));
    pageIndex = Math.max(0, Math.min(pages - 1, pageIndex));
    visible = view.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    heading.textContent = options.label;
    caption.textContent = options.label;
    scroll.setAttribute('aria-label', options.label);
    for (const th of thead.querySelectorAll<HTMLTableCellElement>('th[data-key]')) {
      const active = sort?.key === th.dataset.key;
      th.setAttribute('aria-sort', active ? sort!.direction : 'none');
      th.dataset.sort = active ? sort!.direction : 'none';
      sortAnimations
        .get(th.dataset.key!)
        ?.setTarget(active && sort!.direction === 'descending' ? 0 : 180);
    }
    if (!visible.length) {
      const row = tbody.insertRow(),
        cell = row.insertCell();
      cell.colSpan =
        options.columns.length + (options.selection && options.selection !== 'none' ? 1 : 0);
      cell.className = 'eui-data-table-empty';
      cell.textContent = options.emptyText ?? '没有可显示的数据';
    }
    for (const item of visible) {
      const row = tbody.insertRow();
      row.dataset.rowKey = item.key;
      if (options.selection && options.selection !== 'none') {
        const cell = row.insertCell();
        cell.className = 'eui-data-table-choice';
        const wrapper = document.createElement('span'),
          input = document.createElement('input');
        input.type = options.selection === 'single' ? 'radio' : 'checkbox';
        input.disabled = !selectable(item.row);
        input.checked = selected.has(item.key);
        input.value = item.key;
        input.setAttribute('aria-label', `选择行 ${item.key}`);
        if (options.selection === 'single') {
          input.name = groupName;
          input.setAttribute('form', groupName + '-owner');
        }
        wrapper.append(input);
        cell.append(wrapper);
        const control =
          options.selection === 'single'
            ? enhanceRadio(input, { motionScheme: options.motionScheme ?? 'expressive' })
            : enhanceCheckbox(input, { motionScheme: options.motionScheme ?? 'expressive' });
        pageScope.add(() => control.destroy());
        rowControls.set(item.key, { input, refresh: () => control.refresh(), row });
        pageScope.listen(input, 'change', () => {
          if (options.selection === 'single') selected.clear();
          if (input.checked) selected.add(item.key);
          else selected.delete(item.key);
          selectionChanged();
        });
      }
      for (const column of options.columns) {
        const cell = row.insertCell();
        cell.dataset.numeric = String(column.numeric ?? false);
        const rendered = column.render?.(item.row);
        if (rendered instanceof Node) cell.append(rendered);
        else if (rendered !== undefined) cell.textContent = rendered;
        else {
          const value = column.value(item.row);
          cell.textContent =
            value instanceof Date
              ? new Intl.DateTimeFormat(options.locale ?? 'zh-CN').format(value)
              : String(value ?? '');
        }
      }
    }
    range.textContent = view.length
      ? `${pageIndex * pageSize + 1}–${Math.min(view.length, (pageIndex + 1) * pageSize)} / ${view.length}`
      : '0 / 0';
    first.disabled = previous.disabled = pageIndex === 0;
    next.disabled = last.disabled = pageIndex === pages - 1;
    sizeSelect.value = String(pageSize);
    sizeController.refresh();
    paintSelection();
  }
  function setSort(next: DataTableSort | null, notify = false) {
    if (scope.disposed) return;
    if (next && !options.columns.some((column) => column.key === next.key && column.sortable))
      throw new TypeError('Unknown sortable column');
    sort = next;
    pageIndex = 0;
    rebuildView();
    renderPage();
    if (notify) emit(host, 'eui-sort-change', { sort });
  }
  function setPage(index: number, notify = false) {
    if (scope.disposed || !Number.isFinite(index)) return;
    pageIndex = Math.max(0, Math.trunc(index));
    renderPage();
    if (notify) emit(host, 'eui-page-change', { pageIndex, pageSize, total: view.length });
  }
  scope.listen(first, 'click', () => setPage(0, true));
  scope.listen(previous, 'click', () => setPage(pageIndex - 1, true));
  scope.listen(next, 'click', () => setPage(pageIndex + 1, true));
  scope.listen(last, 'click', () => setPage(Math.ceil(view.length / pageSize) - 1, true));
  scope.listen(sizeSelect, 'change', () => {
    const firstRow = pageIndex * pageSize;
    pageSize = Number(sizeSelect.value);
    pageIndex = Math.floor(firstRow / pageSize);
    setPage(pageIndex, true);
  });
  if (host.closest('form'))
    scope.listen(host.closest('form')!, 'reset', (event) =>
      queueMicrotask(() => {
        if (!event.defaultPrevented && !scope.disposed) {
          selected = new Set((options.selectedKeys ?? []).map(String));
          paintSelection();
        }
      }),
    );
  if (host.closest('form'))
    scope.listen(host.closest('form')!, 'formdata', (event) => {
      if (!options.selectionName) return;
      const fieldset = host.closest('fieldset[disabled]');
      if (fieldset && !fieldset.querySelector(':scope > legend')?.contains(host)) return;
      const data = (event as FormDataEvent).formData;
      for (const row of options.rows) {
        const key = String(options.rowKey(row));
        if (selected.has(key) && selectable(row)) data.append(options.selectionName, key);
      }
    });
  buildHeader();
  rebuildView();
  renderPage();
  return {
    element: host,
    table,
    get selectedKeys() {
      return [...selected];
    },
    get sort() {
      return sort ? { ...sort } : null;
    },
    get pageIndex() {
      return pageIndex;
    },
    get pageSize() {
      return pageSize;
    },
    setSort,
    setPage,
    setSelectedKeys(keys: readonly (string | number)[], { notify = false } = {}) {
      if (scope.disposed) return;
      const valid = new Set(options.rows.map((row) => String(options.rowKey(row))));
      selected = new Set(keys.map(String).filter((key) => valid.has(key)));
      if (options.selection === 'single') selected = new Set([...selected].slice(0, 1));
      if (notify) selectionChanged();
      else paintSelection();
    },
    update(next: Partial<DataTableOptions<Row>>) {
      if (scope.disposed) return;
      const candidate = { ...options, ...next };
      validate(candidate);
      const structural =
        next.columns !== undefined ||
        next.selection !== undefined ||
        next.motionScheme !== undefined ||
        next.selectionName !== undefined;
      options = candidate;
      if (next.sort !== undefined) sort = next.sort;
      if (next.pageSize !== undefined) {
        pageSize = next.pageSize;
        fillSizes();
      } else if (next.pageSizeOptions !== undefined) fillSizes();
      if (next.pageIndex !== undefined) pageIndex = Math.max(0, Math.trunc(next.pageIndex));
      if (next.selectedKeys !== undefined) selected = new Set(next.selectedKeys.map(String));
      if (structural) {
        const focusedKey = visible.find(
          (item) => rowControls.get(item.key)?.input === document.activeElement,
        )?.key;
        buildHeader();
        rebuildView();
        renderPage();
        if (focusedKey) rowControls.get(focusedKey)?.input.focus({ preventScroll: true });
      } else {
        rebuildView();
        renderPage();
      }
      for (const button of pageButtons)
        button.update({ motionScheme: options.motionScheme ?? 'expressive' });
      sizeController.update({ motionScheme: options.motionScheme ?? 'expressive' });
    },
    destroy() {
      scope.dispose();
    },
  };
}
