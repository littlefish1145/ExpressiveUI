import { Scope } from '@amiracle1024/core';
import type { MotionScheme } from '@amiracle1024/motion';
import {
  enhanceTextField,
  enhanceChip,
  enhanceChipSet,
  enhanceSegmentedButtons,
  enhanceDialog,
  enhanceSheet,
  enhanceMenu,
  enhanceTooltip,
  enhanceSnackbar,
  enhanceTabs,
  enhanceNavigationBar,
  enhanceNavigationRail,
  enhanceNavigationDrawer,
  enhanceCard,
  enhanceBadge,
  enhanceDivider,
  enhanceList,
  enhanceAppBar,
  enhanceToolbar,
  enhanceCarousel,
  enhanceProgress,
  enhanceDatePicker,
  enhanceTimePicker,
  enhanceSearch,
  enhanceButtonGroup,
  enhanceSplitButton,
  enhanceFabMenu,
  enhanceRangeSlider,
  enhanceVerticalSlider,
  enhanceButton,
  enhanceIconButton,
} from '@amiracle1024/components';
import './catalog.css';
import { mountExtensions } from './extensions.js';
import { enhanceSelect } from '@amiracle1024/components';

export async function mountCatalog(parent: Scope) {
  const scope = new Scope();
  parent.add(() => scope.dispose());
  const checkpoint = async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (scope.disposed) throw new Error('Catalog disposed during enhancement');
  };
  const section = document.getElementById('component-catalog')!;
  section.id = 'component-catalog';
  section.className = 'catalog-section';
  const main = document.getElementById('main')!;
  if (!section.isConnected) main.append(section);
  scope.add(() => section.remove());
  const overlays = document.createElement('div');
  overlays.className = 'catalog-overlays';
  overlays.innerHTML = `
    <dialog id="catalog-dialog" aria-labelledby="catalog-dialog-title"><h2 id="catalog-dialog-title">Keep this idea?</h2><p>You can come back to it whenever inspiration strikes.</p><div class="eui-picker-actions"><button type="button" data-eui-close data-catalog-overlay-button>Maybe later</button><button type="button" id="catalog-dialog-save" data-catalog-overlay-button>Keep it</button></div></dialog>
    <dialog id="catalog-bottom-sheet" aria-label="项目详情"><h2>A little more detail.</h2><p>Room for context, actions, and the next step.</p><ul><li>Semantic DOM</li><li>Interruptible motion</li><li>Your theme, everywhere</li></ul><button type="button" data-eui-close data-catalog-overlay-button>Done</button></dialog>
    <dialog id="catalog-side-sheet" aria-label="项目设置"><h2>Make it yours.</h2><p>A side sheet keeps the main experience in view.</p><button type="button" data-eui-close data-catalog-overlay-button>Done</button></dialog>
    <aside id="catalog-drawer" aria-label="项目导航"><h2>Your workspace.</h2><button type="button" data-nav-item="projects"><span data-icon aria-hidden="true">▦</span><span data-label>Projects</span></button><button type="button" data-nav-item="favorites"><span data-icon aria-hidden="true">♡</span><span data-label>Favorites</span></button><button type="button" data-nav-item="archive"><span data-icon aria-hidden="true">▣</span><span data-label>Archive</span></button></aside>
    <div id="catalog-menu" aria-label="排序"><button type="button" data-menu-item data-kind="radio" data-group="sort" data-value="recent" aria-checked="true">Recent first</button><button type="button" data-menu-item data-kind="radio" data-group="sort" data-value="name">Name</button><button type="button" data-menu-item data-kind="radio" data-group="sort" data-value="favorite">Favorites</button></div>
    <div id="catalog-send-menu" aria-label="发送方式"><button type="button" data-menu-item data-value="schedule">Schedule send</button><button type="button" data-menu-item data-value="draft">Save as draft</button></div>
    <div id="catalog-tooltip">A small hint, right when you need it.</div><div id="catalog-snackbar"></div>
    <div id="catalog-fab-menu" aria-label="创建项目"><button type="button" data-action="document"><span aria-hidden="true">▤</span>New document</button><button type="button" data-action="canvas"><span aria-hidden="true">✎</span>New canvas</button><button type="button" data-action="folder"><span aria-hidden="true">▦</span>New folder</button></div>`;
  document.body.append(overlays);
  scope.add(() => overlays.remove());
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
  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-catalog-button]'))
    own(enhanceButton(button, { variant: 'tonal' }));
  for (const button of overlays.querySelectorAll<HTMLButtonElement>(
    '[data-catalog-overlay-button]',
  ))
    own(
      enhanceButton(button, { variant: button.hasAttribute('data-eui-close') ? 'text' : 'filled' }),
    );
  await checkpoint();
  const name = own(
    enhanceTextField($<HTMLInputElement>('catalog-name'), {
      label: 'Your name',
      counter: true,
      supportingText: 'The name people will know you by.',
    }),
  );
  const email = own(
    enhanceTextField($<HTMLInputElement>('catalog-email'), {
      variant: 'outlined',
      label: 'Email',
      supportingText: 'A place for your next invitation.',
    }),
  );
  own(
    enhanceTextField($<HTMLTextAreaElement>('catalog-notes'), {
      variant: 'outlined',
      label: 'An idea worth keeping',
      supportingText: 'Leave a little room for possibility.',
    }),
  );
  let error = false;
  scope.listen($('catalog-field-error'), 'click', () => {
    error = !error;
    email.update({ error, errorText: 'Please use a valid email address.' });
    name.refresh();
  });
  own(enhanceChip($<HTMLButtonElement>('catalog-assist'), { variant: 'assist' }));
  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-filter-chip]'))
    own(enhanceChip(button, { variant: 'filter' }));
  const inputChip = own(
    enhanceChip($<HTMLButtonElement>('catalog-input-chip'), {
      variant: 'input',
      onRemove: () => {
        const node = $('catalog-input-chip');
        inputChip.destroy();
        node.remove();
        $('catalog-chip-status').textContent = 'Alex removed.';
        section.querySelector<HTMLButtonElement>('[data-filter-chip]')?.focus();
      },
    }),
  );
  own(enhanceChip($<HTMLButtonElement>('catalog-suggestion'), { variant: 'suggestion' }));
  own(enhanceChipSet($('catalog-chips'), { label: 'Topics' }));
  scope.listen($('catalog-chips'), 'eui-change', () => {
    $('catalog-chip-status').textContent =
      [...section.querySelectorAll<HTMLButtonElement>('[data-filter-chip][aria-pressed=true]')]
        .map((n) => n.textContent)
        .join(', ') || 'Choose what interests you.';
  });
  own(enhanceSegmentedButtons($('catalog-segments'), { label: 'Calendar view' }));
  scope.listen($('catalog-segments'), 'eui-change', (event) => {
    $('catalog-segment-status').textContent =
      'View: ' + (event as CustomEvent<{ values: string[] }>).detail.values.join(', ');
  });
  own(enhanceTabs($('catalog-tabs'), { label: 'Your collection' }));
  await checkpoint();
  own(enhanceNavigationBar($('catalog-nav-bar'), { selected: 'home' }));
  const rail = own(enhanceNavigationRail($('catalog-nav-rail'), { selected: 'inbox' }));
  let expanded = false;
  scope.listen($('catalog-rail-expand'), 'click', () => rail.setExpanded((expanded = !expanded)));
  const drawer = own(
    enhanceNavigationDrawer($('catalog-drawer'), {
      modal: true,
      selected: 'projects',
      label: '项目导航',
    }),
  );
  scope.listen($('catalog-drawer-open'), 'click', () => drawer.open());
  const dialog = own(enhanceDialog($<HTMLDialogElement>('catalog-dialog'))),
    bottom = own(enhanceSheet($('catalog-bottom-sheet'), { edge: 'bottom', label: '项目详情' })),
    side = own(
      enhanceSheet($('catalog-side-sheet'), { edge: 'end', label: '项目设置', dragHandle: false }),
    );
  scope.listen($('catalog-dialog-open'), 'click', dialog.open);
  scope.listen($('catalog-bottom-open'), 'click', bottom.open);
  scope.listen($('catalog-side-open'), 'click', side.open);
  own(enhanceMenu($('catalog-menu'), { anchor: $('catalog-menu-anchor'), indicator: true }));
  own(enhanceTooltip($('catalog-tooltip'), { anchor: $('catalog-tooltip-anchor') }));
  own(
    enhanceSplitButton($('catalog-split'), { menu: $('catalog-send-menu'), label: 'Send message' }),
  );
  for (const id of ['catalog-menu', 'catalog-send-menu'])
    scope.listen($(id), 'eui-select', (event) => {
      $('catalog-menu-status').textContent =
        'Selected: ' + String((event as CustomEvent<{ value: unknown }>).detail.value);
    });
  const snackbar = own(enhanceSnackbar($('catalog-snackbar')));
  scope.listen($('catalog-snack-open'), 'click', () => {
    void snackbar
      .show({ message: 'Your idea was saved.', action: 'Undo', dismissLabel: '关闭通知' })
      .then((result) => {
        if (!scope.disposed)
          $('catalog-snack-status').textContent =
            result === 'action' ? 'Save undone.' : 'Ready for the next idea.';
      });
  });
  scope.listen($('catalog-snack-queue'), 'click', () => {
    void snackbar.show('First, a small update.');
    void snackbar.show('Then, another possibility.');
  });
  scope.listen($('catalog-dialog-save'), 'click', () => {
    dialog.close('save');
    void snackbar.show({ message: 'Kept for a little later.', action: 'Undo' });
  });
  own(enhanceBadge($('catalog-badge-count'), { value: 12, label: '12 封未读邮件' }));
  own(enhanceBadge($('catalog-badge-dot')));
  const progress = [
    own(
      enhanceProgress($('catalog-progress-circular'), {
        label: 'Upload',
        variant: 'circular',
        value: 0.4,
      }),
    ),
    own(
      enhanceProgress($('catalog-progress-wave'), {
        label: 'Expressive upload',
        variant: 'circular',
        wavy: true,
        value: 0.4,
      }),
    ),
    own(
      enhanceProgress($('catalog-progress-indeterminate'), {
        label: 'Connecting',
        variant: 'circular',
        value: null,
      }),
    ),
    own(enhanceProgress($('catalog-progress-linear'), { label: 'Upload', value: 0.4 })),
    own(
      enhanceProgress($('catalog-progress-linear-wave'), {
        label: 'Preparing',
        wavy: true,
        value: null,
      }),
    ),
  ];
  let amount = 0.4,
    paused = false;
  scope.listen($('catalog-progress-step'), 'click', () => {
    amount = amount >= 1 ? 0 : Math.min(1, amount + 0.2);
    for (const index of [0, 1, 3]) progress[index]!.update({ value: amount });
    $('catalog-progress-status').textContent = `Upload: ${Math.round(amount * 100)}%`;
  });
  scope.listen($('catalog-progress-pause'), 'click', () => {
    paused = !paused;
    for (const p of progress)
      if (paused) p.pause();
      else p.play();
  });
  await checkpoint();
  own(enhanceDatePicker($<HTMLInputElement>('catalog-date')));
  await checkpoint();
  own(enhanceTimePicker($<HTMLInputElement>('catalog-time'), { format: 24 }));
  await checkpoint();
  own(
    enhanceDatePicker($<HTMLInputElement>('catalog-date-start'), {
      mode: 'range',
      endInput: $<HTMLInputElement>('catalog-date-end'),
    }),
  );
  await checkpoint();
  own(enhanceCard($('catalog-card'), { variant: 'outlined' }));
  own(enhanceDivider($('catalog-divider')));
  own(enhanceList($('catalog-list'), { variant: 'expressive' }));
  const carousel = own(enhanceCarousel($('catalog-carousel'), { label: 'Creative possibilities' }));
  scope.listen($('catalog-carousel-prev'), 'click', () => carousel.previous());
  scope.listen($('catalog-carousel-next'), 'click', () => carousel.next());
  own(
    enhanceSearch($('catalog-search'), {
      label: 'Search components',
      suggestions: [
        { id: 'shape', label: 'Shape library', value: 'shapes' },
        { id: 'motion', label: 'Motion and springs', value: 'motion' },
        { id: 'color', label: 'Color and themes', value: 'color' },
        { id: 'button', label: 'Buttons and actions', value: 'buttons' },
        { id: 'type', label: 'Typography', value: 'type' },
      ],
    }),
  );
  scope.listen($('catalog-search'), 'submit', (event) => {
    event.preventDefault();
    $('catalog-search-status').textContent =
      'Search: ' +
      $<HTMLInputElement>('catalog-search').querySelector<HTMLInputElement>('input')!.value;
  });
  scope.listen($('catalog-search'), 'eui-select', (event) => {
    $('catalog-search-status').textContent =
      'Selected: ' + (event as CustomEvent<{ result: { label: string } }>).detail.result.label;
  });
  own(enhanceButtonGroup($('catalog-button-group'), { selection: 'single', label: 'Playback' }));
  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-catalog-icon]'))
    own(enhanceIconButton(button, { variant: 'standard' }));
  own(enhanceToolbar($('catalog-toolbar'), { label: 'Creative tools' }));
  own(
    enhanceFabMenu($('catalog-fab-menu'), {
      anchor: $<HTMLButtonElement>('catalog-fab-anchor'),
      label: 'Create',
    }),
  );
  scope.listen($('catalog-fab-menu'), 'click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-action]');
    if (button) $('catalog-fab-status').textContent = 'Ready to create: ' + button.dataset.action;
  });
  const ranges = $('catalog-range').querySelectorAll<HTMLInputElement>('input');
  own(enhanceRangeSlider(ranges[0]!, ranges[1]!, { showValue: 'interaction', showTicks: false }));
  own(
    enhanceVerticalSlider($('catalog-vertical').querySelector<HTMLInputElement>('input')!, {
      showTicks: false,
    }),
  );
  own(
    enhanceAppBar($('catalog-app-bar'), {
      variant: 'large',
      scrollBehavior: 'collapse',
      scrollTarget: $('catalog-app-scroll'),
    }),
  );
  const extensions = mountExtensions(scope, (message) => {
    void snackbar.show(message);
  });
  await checkpoint();
  const selects: ReturnType<typeof enhanceSelect>[] = [];
  for (const select of document.querySelectorAll<HTMLSelectElement>(
    'select:not(.eui-select-native)',
  ))
    selects.push(
      own(
        enhanceSelect(select, {
          label:
            select.getAttribute('aria-label') ??
            select.labels?.[0]?.childNodes[0]?.textContent?.trim() ??
            '选择选项',
        }),
      ),
    );
  const count = document.querySelector('.nav-count');
  if (count) count.textContent = '37';
  const link = document.createElement('a');
  link.className = 'nav-item';
  link.href = '#component-catalog';
  link.textContent = '▦ Full catalog';
  document.querySelector('.sidebar nav')?.append(link);
  scope.add(() => {
    link.remove();
    if (count) count.textContent = '08';
  });
  return {
    refreshSelects() {
      for (const select of selects) select.refresh();
    },
    setMotionScheme(scheme: MotionScheme) {
      extensions.setMotionScheme(scheme);
      for (const update of updaters) update(scheme);
    },
    pause() {
      for (const p of progress) p.pause();
    },
    destroy() {
      scope.dispose();
    },
  };
}
