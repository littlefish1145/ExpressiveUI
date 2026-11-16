import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const file = 'docs/references/sources.json',
  sources = JSON.parse(await readFile(file, 'utf8'));
if (!sources.refs.fonts) {
  const r = await fetch('https://api.github.com/repos/google/fonts/commits/main');
  if (!r.ok) throw Error(String(r.status));
  sources.refs.fonts = { repo: 'google/fonts', sha: (await r.json()).sha };
}
const { sha, repo } = sources.refs.fonts;
await mkdir('packages/components/src/fonts', { recursive: true });
for (const [path, name] of [
  ['ofl/roboto/Roboto[wdth,wght].ttf', '.cache/Roboto.ttf'],
  ['ofl/roboto/OFL.txt', 'packages/components/src/fonts/OFL.txt'],
]) {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${encodeURI(path)}`;
  const r = await fetch(url);
  if (!r.ok) throw Error(`${r.status} ${url}`);
  const body = new Uint8Array(await r.arrayBuffer());
  await writeFile(name, body);
  const snapshot = 'fonts-' + path.split('/').at(-1);
  await writeFile('docs/references/' + snapshot, body);
  sources.records = sources.records.filter((r) => !(r.key === 'fonts' && r.path === path));
  sources.records.push({
    key: 'fonts',
    path,
    url,
    status: 200,
    file: snapshot,
    sha256: createHash('sha256').update(body).digest('hex'),
  });
}
execFileSync(
  'python',
  [
    '-c',
    "from fontTools.ttLib import TTFont; f=TTFont('.cache/Roboto.ttf'); f.flavor='woff2'; f.save('packages/components/src/fonts/Roboto-variable.woff2')",
  ],
  { stdio: 'inherit' },
);
await writeFile(file, JSON.stringify(sources, null, 2) + '\n');
execFileSync('python', ['scripts/subset-font.py'], { stdio: 'inherit' });
console.log('Bundled official Google Fonts Roboto variable WOFF2 with OFL license.');
