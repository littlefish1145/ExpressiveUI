import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const refs = JSON.parse(await readFile('docs/references/sources.json', 'utf8'));
const values = JSON.parse(await readFile('docs/references/token-values.json', 'utf8'));
const cbase = `https://github.com/androidx/androidx/blob/${refs.refs.compose.sha}/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/`;
const link = (file, label = file) => `[${label}](${cbase + file})`;
const { generateTheme, colorRoles } = await import(pathToFileURL(resolve('.cache/theme.mjs')));
const light = generateTheme({ seed: '#6750a4' }),
  dark = generateTheme({ seed: '#6750a4', dark: true });
const shapeFile = await readFile('packages/shape/src/material-shapes.ts', 'utf8');
const names = [...shapeFile.matchAll(/"([a-zA-Z0-9]+)":\[/g)].map((x) => x[1]);
const lines = [
  '# 官方规范映射 / Specification mapping',
  '',
  '研究与首次核验日期：2026-11-14。状态：独立 Web 移植候选版，未获 Google 认证，不宣称完整 MD3E、WCAG 或跨浏览器认证。',
  '',
  '## 证据规则',
  '',
  '优先使用 Google 官方 Material 页面、AndroidX 与 MDC Android 的固定 commit。m3.material.io 正文需要客户端 JavaScript，本次没有启用浏览器或执行该网站脚本；数值以已读取的官方源码为依据。源码、下载结果、commit 和 SHA-256 见 [sources.json](references/sources.json)。404 记录不是证据。',
  '',
  '- [Material 3](https://m3.material.io/)：设计系统入口。',
  '- [Motion](https://m3.material.io/styles/motion)：spring、spatial/effects、scheme 的语义来源。',
  '- [MDC Android](https://github.com/material-components/material-components-android)：交叉核查 Loading Indicator 与 Shape Library，当前 README 已标明 maintenance mode；新 Token 以 Compose 为主。',
  '- [Material 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)：Expressive 是对 M3 的扩展，并非所有 Baseline 组件都被重做。',
  '- [Material Color Utilities](https://github.com/material-foundation/material-color-utilities)：HCT 与 DynamicScheme 官方算法。',
  '',
  '`verified` = 源码中核对了原始值；不代表 Web 渲染已经验证。`derived` = 从已知数据计算。`provisional` = 本项目选择，不能当作官方 Token。dp→CSS px、sp→CSS px 是 Web 移植约定（provisional），不等同物理尺寸。',
  '',
  '## Motion（verified 原始参数）',
  '',
  'Canonical token 为 `md.sys.motion.spring.{fast|default|slow}.{spatial|effects}`，scheme 在主题级选择，不拼入官方 Token 名。质量固定为 1；stiffness 使用 s⁻²，velocity 使用 value/s。',
  '',
  '| Scheme | Token suffix | stiffness | dampingRatio | Source |',
  '|---|---|---:|---:|---|',
  ...Object.entries(values.motion).flatMap(([scheme, tokens]) =>
    Object.entries(tokens).map(
      ([token, p]) =>
        `| ${scheme} | ${token} | ${p.stiffness} | ${p.dampingRatio} | ${link('tokens/' + (scheme === 'expressive' ? 'Expressive' : 'Standard') + 'MotionTokens.kt')} |`,
    ),
  ),
  '',
  'Runtime 的 positionThreshold=0.001、velocityThreshold=0.01、120 Hz WAAPI 采样、20 s 固定采样上限、64 ms 活动帧限制、250 ms 暂停间隔、暂停后台时间均为 provisional Web 策略。时长由解析解与阈值派生，绝不作为官方固定 duration。重定向默认保留速度；显式 kick 是应用自定义行为。采样为 linear keyframes，实际位移曲线来自同一弹簧解。Effects 使用临界阻尼，不能用一条任意 bezier 代替所有 Token。',
  '',
  '## Button（Expressive 尺寸，verified）',
  '',
  '| Size | Height | Inline padding/side | Icon | Gap | Outline | Square radius | Pressed radius | Source |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ...Object.entries(values.buttons).map(
    ([size, p]) =>
      `| ${size} | ${p.height} | ${p.padding} | ${p.icon} | ${p.gap} | ${p.outline} | ${p.square} | ${p.pressed} | ${link('tokens/Button' + { xs: 'XSmall', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'XLarge' }[size] + 'Tokens.kt')} |`,
  ),
  '',
  'Round 默认 full；按压与释放使用相应 radius 的真实几何插值。Button.kt 明确采用 default.effects 防止角半径超调，本库遵循此选择。五个 variant 是 Filled / Filled Tonal / Outlined / Text / Elevated，不能把 variant 本身都视为 Expressive 新增。原生 button 的 type/form/disabled/reset/submit 不改写。',
  '',
  '排版来自 ' +
    link('Button.kt', 'ButtonDefaults.textStyleFor') +
    ' 与 ' +
    link('tokens/TypeScaleTokens.kt') +
    '：XS/SM labelLarge 14/20/500，MD titleMedium 16/24/500，LG headlineSmall 24/32/400，XL headlineLarge 32/40/400（字号/行高/字重）。已随库附带Google Fonts Roboto variable WOFF2（OFL1.1）。没有Roboto字形的字符仍按平台字体回退，字体光栅化不保证逐像素相等。',
  '',
  '| Variant/state | Container role | Foreground role | Status |',
  '|---|---|---|---|',
  '| Filled | primary | on-primary | verified ' + link('tokens/FilledButtonTokens.kt') + ' |',
  '| Tonal | secondary-container | on-secondary-container | verified ' +
    link('tokens/FilledTonalButtonTokens.kt') +
    ' |',
  '| Outlined | transparent | on-surface-variant; outline-variant stroke | verified ' +
    link('tokens/OutlinedButtonTokens.kt') +
    ' |',
  '| Text | transparent | on-surface-variant | verified ' +
    link('tokens/TextButtonTokens.kt') +
    ' |',
  '| Elevated | surface-container-low | primary | verified ' +
    link('tokens/ElevatedButtonTokens.kt') +
    '; shadow uses official Material Web key/ambient levels |',
  '| Disabled Filled / Elevated | on-surface at .10 | on-surface-variant at .38 | verified corresponding tokens |',
  '| Disabled Tonal | on-surface at .12 | on-surface at .38 | verified FilledTonalButtonTokens |',
  '| Disabled Outlined / Text | transparent | on-surface-variant at .38; outlined stroke outline-variant | verified corresponding tokens |',
  '',
  'State opacity hover=.08、focus=.10、pressed=.10 来自 ' +
    link('tokens/StateTokens.kt') +
    '（verified）。最小 hit area 48 CSS px 与 focus ring 3 px/offset3 是 Web a11y 策略（provisional），不是正式 focus token 的复刻。页面视觉间距、toast 等属于 Playground 自定义。',
  '',
  '## 共享交互效果',
  '',
  '| Effect | Parameters / behavior | Official source |',
  '|---|---|---|',
  '| Ripple | fade-in75ms、radius/center225ms、fade-out150ms；radius使用FastOutSlowIn(.4,0,.2,1)，center线性；快速释放保留扩展阶段 | [RippleAnimation.kt](references/compose-RippleAnimation.kt) |',
  '| Ripple radius | 起始.3×max(width,height)，终点half diagonal + bounded10dp；选择控件unbounded20dp | [Ripple.kt](references/compose-Ripple.kt)及对应组件Token |',
  '| Color spring | Oklab四通道；default.effects，Checkbox离场fast.effects；未支持的CSS颜色空间保留浏览器原生值 | [ColorVectorConverter.kt](references/compose-ColorVectorConverter.kt)、各组件源码 |',
  '| Elevation | key alpha.30 / ambient alpha.15；两层位移、blur与spread按level0–5公式 | [Material Web elevation](references/web-_elevation.scss)、[system elevation](references/web-_md-sys-elevation.scss) |',
  '| Font | Roboto variable，WOFF2 lossless转换；OFL1.1 | [官方字体快照](references/fonts-Roboto%5Bwdth%2Cwght%5D.ttf)、[OFL](references/fonts-OFL.txt) |',
  '',
  '## FAB（Baseline + Expressive）',
  '',
  '| Size | Box | Icon | Radius | Status/source |',
  '|---|---:|---:|---:|---|',
  '| small | 40×40 | 24 | 12 | verified ' + link('tokens/FabSmallTokens.kt') + ' |',
  '| regular | 56×56 | 24 | 16 | Baseline verified ' + link('tokens/FabBaselineTokens.kt') + ' |',
  '| medium | 80×80 | 28 | 20 | size/icon verified ' +
    link('tokens/FabMediumTokens.kt') +
    '; radius20 verified in FloatingActionButtonDefaults.mediumShape → ShapeDefaults.LargeIncreased |',
  '| large | 96×96 | 32 | 28 | verified ' + link('tokens/FabLargeTokens.kt') + ' |',
  '| extended regular | height56, padding16, gap8 | 24 | 16 | verified ' +
    link('tokens/ExtendedFabSmallTokens.kt') +
    ' |',
  '| extended medium | height80, padding26, gap16 | 28 | 20 | geometry verified ' +
    link('tokens/ExtendedFabMediumTokens.kt') +
    '; radius20 verified in FloatingActionButtonDefaults.mediumExtendedFabShape |',
  '| extended large | height96, padding28, gap20 | 32 | 28 | verified ' +
    link('tokens/ExtendedFabLargeTokens.kt') +
    ' |',
  '',
  'FAB container=primary-container、content=on-primary-container，见 ' +
    link('tokens/FabPrimaryContainerTokens.kt') +
    '。按压保持容器尺寸，通过Ripple反馈。阴影按Material Web elevation官方key/ambient公式绘制，alpha分别.30/.15；Elevated Button普通level1/hover2，FAB普通level3/hover4，focus/press回到普通level。Extended FAB宽度用fast.spatial、文字alpha用fast.effects，与FloatingActionButton.kt一致；小号extended采用56px配置。',
  '',
  '## Switch（Baseline，verified 尺寸）',
  '',
  'Source: ' + link('tokens/SwitchTokens.kt') + '。不宣称是 Expressive 新版 Switch。',
  '',
  '| Local key | CSS px |',
  '|---|---:|',
  ...Object.entries(values.switch).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '轨道52×32、描边2；thumb 未选16、选中24、按压28。thumb center 从16到36，位移20由尺寸派生。缩放固定24px几何避免逐帧 width。选中轨道 primary/handle on-primary，未选轨道 surface-container-highest/handle outline；选中 hover/focus/press handle primary-container，未选 on-surface-variant。Disabled selected track=on-surface/.12、handle=surface/1；disabled unselected track=surface-container-highest/.12、outline=on-surface/.12、handle=on-surface/.38。40px state layer 使用 counter-scale 保持固定尺寸。上述颜色/opacity 均来自 SwitchTokens；Web transform/state-layer 实现为 derived。原生 checkbox checked 是唯一数据源，role=switch；没有重复 aria-checked 与 checked 竞态。',
  '',
  '## Loading Indicator（Expressive）',
  '',
  'Source: ' + link('LoadingIndicator.kt') + '、' + link('tokens/LoadingIndicatorTokens.kt') + '。',
  '',
  '| Property | Value | Evidence |',
  '|---|---|---|',
  '| Uncontained color | primary | verified |',
  '| Contained container/content | primary-container / on-primary-container | verified |',
  '| Active size / container | 38 / 48×48 | verified |',
  '| Shape sequence | softBurst → cookie9Sided → pentagon → pill → sunny → cookie4Sided → oval → loop | verified |',
  '| Morph spring | stiffness200, dampingRatio0.6 | verified |',
  '| Morph interval | 650 ms | verified |',
  '| Per-morph rotation | 90° | verified |',
  '| Global linear rotation | 360° / 4666 ms | verified |',
  '',
  '径向缩放使用官方RoundedPolygon.calculateBounds/calculateMaxBounds导出的元数据。Morph使用官方feature匹配cubic；采用SpringEstimation欠阻尼包络公式与visibilityThreshold=.1求结束时间，结束后立即切到下一轮廓并保持，直到650ms下一周期再启动。初始旋转90°，全局360°/4666ms；中心按Compose processPath使用控制点边界居中。Reduced Motion为静态首图案，aria progressbar不设置aria-valuenow。',
  '',
  '## Shape Library（verified source / derived rendering）',
  '',
  '35 个 Polygon 来自 ' +
    link('MaterialShapes.kt') +
    '，使用官方 graphics-shapes 1.0.1 的 RoundedPolygon 计算 cubic，保持官方 smoothing 和 rounding。导出器仅替换 Compose Offset/Matrix 辅助类型；见 scripts/export-shapes.mjs。源数据归一化、坐标保留6位小数。',
  '',
  '| Supported official polygon | Source |',
  '|---|---|',
  ...names.map((name) => `| ${name} | ${link('MaterialShapes.kt')} |`),
  '',
  'Rounded family：none0、extraSmall4、small8、medium12、large16、largeIncreased20、extraLarge28、extraLargeIncreased32、extraExtraLarge48、full=min(width,height)/2。来自 ' +
    link('tokens/ShapeTokens.kt') +
    '；支持extraSmallTop、largeTop、largeStart、largeEnd、extraLargeTop五个非对称Token，并按direction镜像逻辑start/end；圆角在实际像素空间计算。',
  '',
  '35个Polygon的全部1190组有向匹配由官方AndroidX Morph计算，7位小数存储，按需加载。createMorph.ready完成后cubicsAt(t)直接插值官方对应控制点，SVG、CSS shape()、SVG clipPath/mask使用cubic曲线；CSS polygon为同一曲线的采样后备。Rounded→Rounded使用解析圆角cubic。Rounded与Polygon跨family没有官方Token级映射，按原始需求用等弧长采样桥接，明确为Web几何策略。自定义输入不支持洞/多轮廓，也不承诺自交拓扑保持。',
  '',
  '## Theme（官方算法；可选动态 HCT 入口）',
  '',
  '运行依赖固定 @material/material-color-utilities 0.3.0；上游当前参考 snapshot package.json 为0.4.0，不将两者混同。实现使用已安装0.3.0提供的 DynamicScheme 与9个官方 Scheme 类，不手写近似 HCT。Variant：tonal-spot、expressive、vibrant、neutral、monochrome、fidelity、content、rainbow、fruit-salad。contrastLevel 范围[-1,1]；0/.5/1 是展示选项，不保证任意自定义搭配均 WCAG AA。',
  '',
  '下表为默认 seed #6750a4、tonal-spot、contrast0 的实际算法输出（derived，不是固定官方色板）。每一项转为 `--md-sys-color-{kebab-case}`；来源为 MCU ' +
    `[DynamicScheme 0.3.0](https://www.npmjs.com/package/@material/material-color-utilities/v/0.3.0)` +
    '。',
  '',
  '| Role | Light | Dark |',
  '|---|---|---|',
  ...colorRoles.map((role) => `| ${role} | ${light.colors[role]} | ${dark.colors[role]} |`),
  '',
  '## 扩展组件与新配色',
  '',
  'Icon Button、Checkbox、Radio、Slider 的全部尺寸、选中形变、事件、键盘与颜色映射见 [controls-spec-mapping.md](controls-spec-mapping.md)。包含8组HCT配色预设，并明确区分Baseline、Expressive与Web平台适配。',
  '',
  '## 公开 CSS 变量与限制',
  '',
  'Data Table、Banner、Flexible app bar、Assist Chip和Select的新增API与官方版本边界见[extensions-spec-mapping.md](extensions-spec-mapping.md)。Data Table与Banner属于M3主题扩展，不标为官方Expressive新组件。',
  '',
  '`--eui-*` 都是本库扩展 API，不是官方 Google Token。完整清单见 [api.md](api.md)。所有 style 可通过 CSS layer 顺序或稳定变量覆盖；JS 几何依赖的 radius 需调用 refresh 重新读取。CSS color-mix / corner-shape / @property 只作能力报告，组件不依赖它们。',
  '',
  '已完成的实现差异与验证证据见[parity-status.md](parity-status.md)。CSS px、焦点outline、原生表单事件、后台冻结、Motion全局预览策略、跨family采样等为明确的平台适配契约，不冒充官方Android Token。浏览器、屏幕阅读器、DPR视觉与设备性能仍待手工验收，不能由单元测试替代。',
];
await writeFile('docs/spec-mapping.md', lines.join('\n') + '\n');
console.log(
  'Generated specification mapping:',
  names.length,
  'polygons and',
  colorRoles.length,
  'color roles.',
);
