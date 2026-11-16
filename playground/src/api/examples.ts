export interface Example {
  cdn?: string;
  html: string;
  ts: string;
  react: string;
  css: string;
  reactKind: string;
  notes: string;
}
const commonCSS = `body { margin: 0; padding: 28px; font: 400 16px/1.5 var(--eui-font-family, sans-serif); background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }
.row { display:flex; align-items:center; flex-wrap:wrap; gap:16px; margin:16px 0; }
.stack { display:grid; gap:20px; max-width:460px; }
.shape { position:relative; width:160px; height:160px; color:var(--md-sys-color-primary); }
pre { white-space:pre-wrap; overflow-wrap:anywhere; }
button, input, textarea, select { font:inherit; }
`;
type Spec = {
  html: string;
  imports: string;
  body: string;
  css?: string;
  react?: string;
  notes?: string;
};
function component(
  imports: string,
  body: string,
  html: string,
  css = '',
  react?: string,
  notes?: string,
): Spec {
  return {
    imports: `import { ${imports} } from '@amiracle1024/components';`,
    body,
    html,
    css,
    ...(react ? { react } : {}),
    ...(notes ? { notes } : {}),
  };
}
const specs: Record<string, Spec> = {
  'components/button': component(
    'enhanceButton',
    `own(enhanceButton($<HTMLButtonElement>('save'), {variant:'filled',size:'md'}));`,
    '<button id="save" type="button">Save changes</button>',
  ),
  'components/fab': component(
    'enhanceFab',
    `own(enhanceFab($<HTMLButtonElement>('create'), {extended:true,size:'regular'}));`,
    '<button id="create" type="button" aria-label="Create document"><span data-icon aria-hidden="true">＋</span>Create</button>',
  ),
  'components/switch': component(
    'enhanceSwitch',
    `own(enhanceSwitch($<HTMLInputElement>('notifications')));`,
    '<label class="row"><span><input id="notifications" type="checkbox" checked></span>Notifications</label>',
  ),
  'components/loading-indicator': component(
    'enhanceLoadingIndicator',
    `own(enhanceLoadingIndicator($('loading'),{label:'Loading your workspace',contained:true}));`,
    '<div id="loading"></div>',
  ),
  'components/icon-button': component(
    'enhanceIconButton',
    `own(enhanceIconButton($<HTMLButtonElement>('favorite'),{variant:'tonal',toggle:true}));`,
    '<button id="favorite" type="button" aria-label="Favorite"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg></button>',
  ),
  'components/checkbox': component(
    'enhanceCheckbox',
    `own(enhanceCheckbox($<HTMLInputElement>('accept')));`,
    '<label class="row"><span><input id="accept" type="checkbox"></span>I agree to the terms</label>',
  ),
  'components/radio': component(
    'enhanceRadio',
    `for(const input of root.querySelectorAll<HTMLInputElement>('input')) own(enhanceRadio(input));`,
    '<fieldset><legend>Preferred plan</legend><label class="row"><span><input type="radio" name="plan" value="free" checked></span>Free</label><label class="row"><span><input type="radio" name="plan" value="pro"></span>Pro</label></fieldset>',
  ),
  'components/slider': component(
    'enhanceSlider',
    `own(enhanceSlider($<HTMLInputElement>('volume'),{showTicks:true}));`,
    '<label for="volume">Volume</label><span><input id="volume" type="range" min="0" max="100" step="10" value="40"></span>',
  ),
  'components/text-field': component(
    'enhanceTextField',
    `own(enhanceTextField($<HTMLInputElement>('name'),{label:'Your name',supportingText:'Used on your profile',counter:true}));`,
    '<span class="stack"><input id="name" name="name" aria-label="Your name" maxlength="40" value="Alex"></span>',
  ),
  'components/chip': component(
    'enhanceChip,enhanceChipSet',
    `for(const button of root.querySelectorAll<HTMLButtonElement>('button')) own(enhanceChip(button,{variant:button.id==='assist'?'assist':'filter'}));
own(enhanceChipSet($('topics'),{label:'Topics'}));`,
    '<button id="assist" type="button">Add to calendar</button><div id="topics" class="row"><button type="button" data-value="design">Design</button><button type="button" data-value="motion">Motion</button></div>',
  ),
  'components/segmented-button': component(
    'enhanceSegmentedButtons',
    `own(enhanceSegmentedButtons($('view'),{label:'Calendar view'}));`,
    '<div id="view"><button type="button" data-value="day">Day</button><button type="button" data-value="week">Week</button><button type="button" data-value="month">Month</button></div>',
  ),
  'components/dialog': component(
    'enhanceDialog,enhanceButton',
    `const dialog=own(enhanceDialog($<HTMLDialogElement>('dialog')));
own(enhanceButton($<HTMLButtonElement>('open')));
scope.listen($('open'),'click',()=>dialog.open());`,
    '<button id="open" type="button">Open dialog</button><dialog id="dialog" aria-labelledby="title"><h2 id="title">Keep this idea?</h2><p>You can return whenever inspiration strikes.</p><button type="button" data-eui-close>Close</button></dialog>',
  ),
  'components/sheet': component(
    'enhanceSheet,enhanceButton',
    `const sheet=own(enhanceSheet($('sheet'),{edge:'bottom',label:'More details'}));
own(enhanceButton($<HTMLButtonElement>('open')));
scope.listen($('open'),'click',()=>sheet.open());`,
    '<button id="open" type="button">Open bottom sheet</button><dialog id="sheet" aria-labelledby="title"><h2 id="title">A little more detail</h2><p>Semantic DOM and interruptible motion.</p><button type="button" data-eui-close>Done</button></dialog>',
  ),
  'components/menu': component(
    'enhanceMenu,enhanceButton',
    `const anchor=$<HTMLButtonElement>('sort');own(enhanceButton(anchor,{variant:'tonal'}));own(enhanceMenu($('menu'),{anchor,indicator:true}));`,
    '<button id="sort" type="button">Sort options</button><div id="menu" aria-label="Sort"><button type="button" data-menu-item data-kind="radio" data-group="sort" data-value="recent" aria-checked="true">Recent first</button><button type="button" data-menu-item data-kind="radio" data-group="sort" data-value="name">Name</button></div>',
  ),
  'components/tooltip': component(
    'enhanceTooltip,enhanceButton',
    `const anchor=$<HTMLButtonElement>('hint');own(enhanceButton(anchor,{variant:'tonal'}));own(enhanceTooltip($('tooltip'),{anchor}));`,
    '<button id="hint" type="button">Hover or focus me</button><div id="tooltip">Your work is saved automatically.</div>',
  ),
  'components/snackbar': component(
    'enhanceSnackbar,enhanceButton',
    `const snackbar=own(enhanceSnackbar($('snackbar')));own(enhanceButton($<HTMLButtonElement>('save')));scope.listen($('save'),'click',()=>{void snackbar.show({message:'Your idea was saved.',action:'Undo',dismissLabel:'Dismiss notification'});});`,
    '<button id="save" type="button">Save idea</button><div id="snackbar"></div>',
  ),
  'components/tabs': component(
    'enhanceTabs',
    `own(enhanceTabs($('tabs'),{label:'Your library'}));`,
    '<div id="tabs"><button type="button" data-tab="ideas">Ideas</button><button type="button" data-tab="saved">Saved</button></div><section id="ideas"><h2>Space for ideas.</h2></section><section id="saved"><h2>Your favorites.</h2></section>',
  ),
  'components/navigation': component(
    'enhanceNavigationBar,enhanceNavigationRail',
    `own(enhanceNavigationBar($('bar'),{selected:'home',label:'Main navigation'}));own(enhanceNavigationRail($('rail'),{selected:'inbox',label:'Workspace'}));`,
    '<nav id="bar"><button type="button" data-nav-item="home"><span data-icon aria-hidden="true">⌂</span><span data-label>Home</span></button><button type="button" data-nav-item="saved"><span data-icon aria-hidden="true">☆</span><span data-label>Saved</span></button></nav><nav id="rail"><button type="button" data-nav-item="inbox"><span data-icon aria-hidden="true">✉</span><span data-label>Inbox</span></button></nav>',
  ),
  'components/surfaces': component(
    'enhanceCard,enhanceBadge,enhanceDivider,enhanceList',
    `own(enhanceCard($('card'),{variant:'outlined'}));own(enhanceBadge($('badge'),{value:12,label:'12 unread messages'}));own(enhanceDivider($('divider')));own(enhanceList($('list'),{variant:'expressive'}));`,
    '<article id="card"><h2>Related ideas <span id="badge"></span></h2><span id="divider"></span><ul id="list"><li data-list-item>Expressive shapes</li><li data-list-item>Natural motion</li></ul></article>',
  ),
  'components/app-bar': component(
    'enhanceAppBar,enhanceToolbar,enhanceIconButton',
    `own(enhanceAppBar($('bar'),{variant:'medium-flex',subtitle:'Your workspace',scrollTarget:$('scroller'),scrollBehavior:'collapse'}));own(enhanceToolbar($('tools'),{label:'Edit tools'}));for(const b of root.querySelectorAll<HTMLButtonElement>('button')) own(enhanceIconButton(b));`,
    '<div id="scroller" style="height:280px;overflow:auto"><header id="bar"><span data-title>A new chapter</span></header><div style="height:650px;padding:16px">Scroll this panel.</div></div><div id="tools"><button type="button" aria-label="Add">＋</button><button type="button" aria-label="Favorite">☆</button></div>',
  ),
  'components/carousel': component(
    'enhanceCarousel',
    `own(enhanceCarousel($('carousel'),{label:'Creative possibilities'}));`,
    '<div id="carousel"><article data-carousel-item>Make something.</article><article data-carousel-item>Try a new angle.</article><article data-carousel-item>Keep it close.</article></div>',
    '[data-carousel-item]{min-height:200px;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);padding:24px;}',
  ),
  'components/progress': component(
    'enhanceProgress',
    `own(enhanceProgress($('progress'),{label:'Preparing workspace',variant:'circular',value:null,wavy:true}));own(enhanceProgress($('upload'),{label:'Upload progress',value:.6}));`,
    '<div class="row"><div id="progress"></div></div><div id="upload"></div>',
  ),
  'components/date-picker': component(
    'enhanceDatePicker',
    `own(enhanceDatePicker($<HTMLInputElement>('date'),{locale:'zh-CN'}));`,
    '<label for="date">Date</label><div><input id="date" type="date" value="2026-11-15"></div>',
  ),
  'components/time-picker': component(
    'enhanceTimePicker',
    `own(enhanceTimePicker($<HTMLInputElement>('time'),{format:24}));`,
    '<label for="time">Time</label><div><input id="time" type="time" value="14:30"></div>',
  ),
  'components/search': component(
    'enhanceSearch',
    `own(enhanceSearch($('search'),{label:'Search library',suggestions:[{id:'shape',label:'Shape library'},{id:'motion',label:'Motion and springs'},{id:'theme',label:'Color and themes'}]}));scope.listen($('search'),'submit',event=>event.preventDefault());`,
    '<form id="search" role="search"><input type="search" aria-label="Search library" placeholder="Try shapes or motion" autocomplete="off"></form>',
  ),
  'components/button-group': component(
    'enhanceButtonGroup,enhanceSplitButton',
    `own(enhanceButtonGroup($('group'),{selection:'single',label:'Playback'}));own(enhanceSplitButton($('split'),{menu:$('menu'),label:'Send message'}));`,
    '<div id="group"><button type="button" data-value="play">Play</button><button type="button" data-value="pause">Pause</button></div><div id="split" class="row"><button type="button">Send message</button><button type="button" aria-label="More send options"></button></div><div id="menu" aria-label="Send options"><button type="button" data-menu-item>Schedule send</button><button type="button" data-menu-item>Save draft</button></div>',
  ),
  'components/fab-menu': component(
    'enhanceFabMenu',
    `own(enhanceFabMenu($('menu'),{anchor:$<HTMLButtonElement>('create'),label:'Create something'}));`,
    '<button type="button" id="create" aria-label="Create"><span data-icon aria-hidden="true">＋</span></button><div id="menu"><button type="button">New document</button><button type="button">New folder</button></div>',
  ),
  'components/advanced-slider': component(
    'enhanceRangeSlider,enhanceVerticalSlider',
    `own(enhanceRangeSlider($<HTMLInputElement>('min'),$<HTMLInputElement>('max')));own(enhanceVerticalSlider($<HTMLInputElement>('level')));`,
    '<span><input id="min" type="range" aria-label="Minimum" min="0" max="100" value="20"><input id="max" type="range" aria-label="Maximum" min="0" max="100" value="75"></span><div class="row"><span><input id="level" type="range" aria-label="Level" min="0" max="100" value="60"></span></div>',
  ),
  'components/select': component(
    'enhanceSelect',
    `own(enhanceSelect($<HTMLSelectElement>('sort'),{label:'Sort projects'}));`,
    '<label for="sort">Sort projects</label><select id="sort" name="sort"><option value="recent">Recent first</option><option value="name">Name</option><option value="favorites">Favorites</option></select>',
  ),
  'components/data-table': component(
    'enhanceDataTable',
    `own(enhanceDataTable($('table'),{label:'Projects',rows:[{id:1,name:'Shape studio',tasks:12},{id:2,name:'Motion library',tasks:8},{id:3,name:'Color tools',tasks:24}],rowKey:row=>row.id,columns:[{key:'name',label:'Project',value:row=>row.name,sortable:true},{key:'tasks',label:'Tasks',value:row=>row.tasks,sortable:true,numeric:true}],selection:'multiple',pageSize:2,pageSizeOptions:[2,5]}));`,
    '<div id="table"></div>',
    undefined,
    undefined,
    'M3 主题扩展；排序、选择、分页是客户端行为，不宣称为官方 Expressive 新组件。',
  ),
  'components/banner': component(
    'enhanceBanner',
    `own(enhanceBanner($('banner'),{message:'You are working offline.',primaryAction:{label:'Retry',onClick:()=>console.log('Retry requested')},secondaryAction:{label:'Dismiss',dismiss:true}}));`,
    '<div id="banner"></div>',
    undefined,
    undefined,
    'M3 主题扩展，使用 Banner 模式；不是已确认的 Expressive Token family。',
  ),
};
const dedicated: Record<string, string> = {
  button: `import {Button} from '@amiracle1024/adapter-react';\nexport default function App(){return <Button options={{variant:'filled',size:'md'}}>Save changes</Button>;}`,
  fab: `import {Fab} from '@amiracle1024/adapter-react';\nexport default function App(){return <Fab options={{extended:true}} aria-label="Create"><span data-icon aria-hidden="true">＋</span>Create</Fab>;}`,
  switch: `import {useState} from 'react';\nimport {Switch} from '@amiracle1024/adapter-react';\nexport default function App(){const [checked,setChecked]=useState(true);return <label className="row"><Switch checked={checked} onChange={event=>setChecked(event.currentTarget.checked)} aria-label="Notifications"/>Notifications</label>;}`,
  'loading-indicator': `import {LoadingIndicator} from '@amiracle1024/adapter-react';\nexport default function App(){return <LoadingIndicator options={{label:'Loading workspace',contained:true}}/>;}`,
  'icon-button': `import {IconButton} from '@amiracle1024/adapter-react';\nexport default function App(){return <IconButton options={{variant:'tonal',toggle:true}} aria-label="Favorite"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg></IconButton>;}`,
  checkbox: `import {Checkbox} from '@amiracle1024/adapter-react';\nexport default function App(){return <label className="row"><Checkbox aria-label="Agree to terms"/>I agree to the terms</label>;}`,
  radio: `import {Radio} from '@amiracle1024/adapter-react';\nexport default function App(){return <fieldset><legend>Plan</legend><label className="row"><Radio name="plan" value="free" defaultChecked/>Free</label><label className="row"><Radio name="plan" value="pro"/>Pro</label></fieldset>;}`,
  slider: `import {Slider} from '@amiracle1024/adapter-react';\nexport default function App(){return <Slider aria-label="Volume" options={{showTicks:true}} step={10} min={0} max={100} defaultValue={40}/>;}`,
};
function engine(page: string): Spec {
  const group = page.split('/')[0];
  if (group === 'styles')
    return component(
      'enhanceButton',
      `own(enhanceButton($<HTMLButtonElement>('custom')));`,
      '<button type="button" id="custom">Your own expression</button>',
      '#custom { --eui-button-container:var(--md-sys-color-tertiary-container);--eui-button-color:var(--md-sys-color-on-tertiary-container);--eui-button-height:56px;--eui-button-radius:16px; }',
    );
  if (group === 'core')
    return {
      html: '<pre id="output"></pre>',
      imports: `import {createStore,detectCapabilities,observeViewport} from '@amiracle1024/core';`,
      body: `const store=createStore(0);const off=store.subscribe(value=>{$('output').textContent=JSON.stringify({value,capabilities:detectCapabilities()},null,2);});scope.add(off);store.set(1);const view=observeViewport(root,visible=>console.log({visible}));scope.add(()=>view.destroy());`,
    };
  if (group === 'tokens')
    return {
      html: '<pre id="output"></pre>',
      imports: `import {motionTokens,buttonTokens} from '@amiracle1024/tokens';`,
      body: `$('output').textContent=JSON.stringify({motion:motionTokens.expressive,button:buttonTokens.md},null,2);`,
    };
  if (group === 'theme')
    return {
      html: '<div id="palette" class="row"></div>',
      imports: `import {generateTheme,createThemeController} from '@amiracle1024/theme';`,
      body: `const light=generateTheme({seed:'#157A6E',variant:'expressive'});const dark=generateTheme({seed:'#157A6E',variant:'expressive',dark:true});const theme=createThemeController(root,{light,dark},'light');scope.add(()=>theme.destroy());for(const role of ['primary','secondary','tertiary'] as const){const swatch=document.createElement('div');swatch.textContent=role;swatch.style.cssText='padding:24px;border-radius:20px;background:'+light.colors[role]+';color:'+light.colors[('on'+role.charAt(0).toUpperCase()+role.slice(1)) as 'onPrimary'];$('palette').append(swatch);}`,
    };
  if (group === 'shape')
    return {
      html: '<div id="shape" class="shape"></div><pre id="output"></pre>',
      imports: `import {createMorph,createShapeRenderer,cubicPathDiscontinuity} from '@amiracle1024/shape';\nimport {createSpring,motionPreset} from '@amiracle1024/motion';`,
      body: `const pair=createMorph('circle','flower');await pair.ready;const renderer=createShapeRenderer($('shape'),'svg');scope.add(()=>renderer.destroy());const spring=createSpring(0,value=>{const path=pair.cubicsAt(value)!;renderer.drawCubics(path);$('output').textContent='C0 seam: '+cubicPathDiscontinuity(path);},motionPreset());scope.add(()=>spring.destroy());spring.setTarget(1);`,
      notes:
        '常规 Polygon→Polygon 使用官方匹配 cubic；中断重定向与混合形状的 Web 策略不等同于官方路径匹配。',
    };
  return {
    html: '<div id="ball" style="width:48px;height:48px;border-radius:50%;background:var(--md-sys-color-primary)"></div><pre id="output"></pre>',
    imports: `import {createSpring,motionPreset,solveSpring} from '@amiracle1024/motion';`,
    body: `const parameters=motionPreset('expressive','fast.spatial');const spring=createSpring(0,(value,velocity)=>{$('ball').style.transform='translateX('+(value*180)+'px)';$('output').textContent=JSON.stringify({value,velocity,reference:solveSpring(0,1,0,.2,parameters)},null,2);},parameters);scope.add(()=>spring.destroy());spring.setTarget(1);`,
    notes: '质量归一化为1；时间单位秒，速度是值单位/秒。Reduced Motion 始终由库策略处理。',
  };
}
export function exampleFor(page: string, symbol = ''): Example {
  if (page === 'adapter-react/index') {
    const key =
      Object.keys(dedicated).find(
        (key) =>
          ({
            button: 'Button',
            fab: 'Fab',
            switch: 'Switch',
            'loading-indicator': 'LoadingIndicator',
            'icon-button': 'IconButton',
            checkbox: 'Checkbox',
            radio: 'Radio',
            slider: 'Slider',
          })[key] === symbol,
      ) ?? 'button';
    return exampleFor('components/' + key);
  }
  const spec = specs[page] ?? engine(page);
  const helpers =
    (spec.body.includes('own(')
      ? `const own=<T extends {destroy():void}>(controller:T)=>{scope.add(()=>controller.destroy());return controller;};\n`
      : '') +
    (spec.body.includes('$')
      ? `const $=<T extends HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;\n`
      : '');
  const ts = `import {Scope} from '@amiracle1024/core';\n${spec.imports}\n\nexport async function mount(root:HTMLElement){\nconst scope=new Scope();\n${helpers}try {\n${spec.body}\n} catch(error) {scope.dispose();throw error;}\nreturn ()=>scope.dispose();\n}`;
  const key = page.replace('components/', '');
  const specific = dedicated[key];
  const react =
    specific ??
    `import {useEffect,useRef} from 'react';\n${ts}\n\nexport default function App(){\n const host=useRef<HTMLDivElement>(null);\n useEffect(()=>{\n  const root=document.createElement('div');host.current!.append(root);\n  root.innerHTML=${JSON.stringify(spec.html)};\n  let disposed=false;let release:(()=>void)|undefined;\n  void mount(root).then(cleanup=>{if(disposed)cleanup();else release=cleanup;}).catch(error=>{if(!disposed){root.textContent=String(error);throw error;}});\n  return ()=>{disposed=true;release?.();root.remove();};\n },[]);\n return <div ref={host}/>;\n}`;
  return {
    html: spec.html,
    ts,
    react,
    css: commonCSS + (spec.css ?? ''),
    reactKind: specific ? '专用 React adapter' : 'React useEffect 集成（无专用适配组件）',
    notes: spec.notes ?? '示例使用真实导出。控制器由 Scope 管理，销毁时释放动画、观察器和监听。',
  };
}
