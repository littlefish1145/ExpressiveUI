import { writeFile, mkdir } from 'node:fs/promises';
const repos = {
  android: ['material-components/material-components-android', 'master'],
  compose: ['androidx/androidx', 'androidx-main'],
  color: ['material-foundation/material-color-utilities', 'main'],
};
await mkdir('docs/references', { recursive: true });
const refs = {};
for (const [key, [repo, branch]] of Object.entries(repos)) {
  const response = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`);
  if (!response.ok) throw Error(`${response.status} ${repo}`);
  refs[key] = { repo, sha: (await response.json()).sha };
}
const files = {
  android: [
    'lib/java/com/google/android/material/motion/MotionUtils.java',
    'lib/java/com/google/android/material/shape/MaterialShapes.java',
    'lib/java/com/google/android/material/loadingindicator/LoadingIndicatorDrawingDelegate.java',
    'lib/java/com/google/android/material/loadingindicator/LoadingIndicatorAnimatorDelegate.java',
    'lib/java/com/google/android/material/button/res/values/dimens.xml',
    'lib/java/com/google/android/material/button/res/values/styles.xml',
    'lib/java/com/google/android/material/motion/res/values/tokens.xml',
    'lib/java/com/google/android/material/switchmaterial/res/values/dimens.xml',
  ],
  compose: [
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionSchemeKeyTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ExpressiveMotionTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/StandardMotionTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ButtonSmallTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ButtonMediumTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ButtonLargeTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ButtonXLargeTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ButtonXSmallTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/SwitchTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/FabPrimaryTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ShapeTokens.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/LoadingIndicator.kt',
    'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt',
  ],
  color: ['typescript/package.json', 'LICENSE'],
};
const records = await Promise.all(
  Object.entries(files).flatMap(([key, paths]) =>
    paths.map(async (path) => {
      const { repo, sha } = refs[key];
      const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
      const r = await fetch(url);
      const name = `${key}-${path.split('/').at(-1)}`;
      if (r.ok) await writeFile(`docs/references/${name}`, await r.text());
      return { key, path, url, status: r.status, file: r.ok ? name : null };
    }),
  ),
);
await writeFile(
  'docs/references/sources.json',
  JSON.stringify({ retrieved: '2026-11-14', refs, records }, null, 2) + '\n',
);
console.log(JSON.stringify({ refs, records }, null, 2));
