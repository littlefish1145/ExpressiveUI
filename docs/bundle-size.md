# 包体积报告

由 `npm run size` 自动生成。单位为字节，gzip level 9；当前工具版本见 package-lock.json。预算为优化目标。

| Package | ESM source¹ | Minified bundle² | Gzip | Budget |
|---|---:|---:|---:|---|
| core | 8027 B | 4097 B | 1858 B | PASS / 6144 B |
| shape | 10776322 B | 114912 B | 41394 B | OVER / 8192 B |
| shape/geometry | 10776322 B | 4089 B | 1780 B | PASS / 8192 B |
| shape/renderer | 10776322 B | 4424 B | 1732 B | PASS / 8192 B |
| motion | 20024 B | 10842 B | 4519 B | PASS / 5120 B |
| theme/runtime | 6276 B | 1819 B | 870 B | PASS / 4096 B |
| theme/HCT | 6276 B | 55145 B | 16535 B | — |
| components | 255698 B | 258513 B | 84681 B | — |

¹ 包内 .js 总和（不含 map、类型和 CSS）。² 浏览器打包并 minify，含传递依赖；不可将重叠包简单相加。

Components CSS 源码 82904 B；合并压缩后 gzip 11250 B（单独计费，不隐藏 CSS 成本）。

| Tree shaking probe | Minified | Gzip | HCT | Full polygon library |
|---|---:|---:|---|---|
| core capability only | 721 B | 417 B | no | no |
| motion solver only | 1178 B | 563 B | no | no |
| shape numeric geometry only | 328 B | 230 B | no | no |
| one button only | 27536 B | 10296 B | no | no |

表中bundle/gzip包含入口及其静态共享依赖，按需加载的官方形变数据及加载索引另列。预算作优化目标，不删减官方几何精度来达标。

| Package | Lazy chunks | All emitted JS |
|---|---:|---:|
| core | 0 | 4097 B |
| shape | 1184 | 8682223 B |
| shape/geometry | 0 | 4089 B |
| shape/renderer | 0 | 4424 B |
| motion | 0 | 10842 B |
| theme/runtime | 0 | 1819 B |
| theme/HCT | 0 | 55145 B |
| components | 1184 | 8825824 B |

Roboto variable WOFF2（Latin + extended，按unicode-range加载）：195840 B，独立缓存，未混入JS/CSS gzip。完整1190组官方匹配均可按需加载；Loading Indicator的七组匹配为静态依赖。
