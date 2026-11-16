import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const file = 'docs/references/sources.json',
  sources = JSON.parse(await readFile(file, 'utf8'));
const sha = sources.refs.compose.sha,
  base = 'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/';
const paths = [
  ['compose', base + 'Switch.kt'],
  ['compose', base + 'internal/ShapeUtil.kt'],
  ['compose', base + 'Tooltip.kt'],
  [
    'compose',
    'compose/animation/animation/src/commonMain/kotlin/androidx/compose/animation/ColorVectorConverter.kt',
  ],
  [
    'compose',
    'compose/material/material-ripple/src/commonMain/kotlin/androidx/compose/material/ripple/RippleAnimation.kt',
  ],
  [
    'compose',
    'compose/material/material-ripple/src/commonMain/kotlin/androidx/compose/material/ripple/Ripple.kt',
  ],
  [
    'compose',
    'compose/animation/animation-core/src/commonMain/kotlin/androidx/compose/animation/core/SpringEstimation.kt',
  ],
  ['compose', base + 'tokens/ElevationTokens.kt'],
  ['compose', base + 'tokens/ShapeTokens.kt'],
];
for (const [name, repo, branch] of [
  ['web', 'material-components/material-web', 'main'],
  ['shapes', 'androidx/androidx', 'androidx-main'],
]) {
  if (!sources.refs[name]) {
    const r = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`);
    if (!r.ok) throw Error(String(r.status));
    sources.refs[name] = { repo, sha: (await r.json()).sha };
  }
}
paths.push(['web', 'elevation/internal/_elevation.scss'], ['web', 'tokens/_md-sys-elevation.scss']);
for (const [key, path] of paths) {
  const ref = key === 'compose' ? sources.refs.compose : sources.refs[key];
  const url = `https://raw.githubusercontent.com/${ref.repo}/${ref.sha}/${path}`;
  const r = await fetch(url);
  if (!r.ok) {
    console.log('Unavailable', r.status, path);
    continue;
  }
  const body = await r.text(),
    name = `${key}-${path.split('/').at(-1)}`;
  await writeFile('docs/references/' + name, body);
  const record = {
    key,
    path,
    url,
    status: 200,
    file: name,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
  const i = sources.records.findIndex((x) => x.key === key && x.path === path);
  if (i < 0) sources.records.push(record);
  else sources.records[i] = record;
  console.log(name);
}
await writeFile(file, JSON.stringify(sources, null, 2) + '\n');
