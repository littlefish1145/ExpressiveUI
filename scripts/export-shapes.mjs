// Offline, optional authoring tool. Java 17+ required. Not part of normal npm build.
// Executes the official AndroidX geometry code, with a minimal Compose-free coordinate shim.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, delimiter } from 'node:path';
const dir = resolve('.cache/shape-export');
await mkdir(dir, { recursive: true });
const artifacts = [
  [
    'compiler.jar',
    'https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-compiler-embeddable/2.1.0/kotlin-compiler-embeddable-2.1.0.jar',
  ],
  [
    'stdlib.jar',
    'https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/2.1.0/kotlin-stdlib-2.1.0.jar',
  ],
  [
    'script.jar',
    'https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-script-runtime/2.1.0/kotlin-script-runtime-2.1.0.jar',
  ],
  [
    'reflect.jar',
    'https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-reflect/1.6.10/kotlin-reflect-1.6.10.jar',
  ],
  [
    'trove.jar',
    'https://repo.maven.apache.org/maven2/org/jetbrains/intellij/deps/trove4j/1.0.20200330/trove4j-1.0.20200330.jar',
  ],
  [
    'coroutines.jar',
    'https://repo.maven.apache.org/maven2/org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.6.4/kotlinx-coroutines-core-jvm-1.6.4.jar',
  ],
  [
    'annotations.jar',
    'https://repo.maven.apache.org/maven2/org/jetbrains/annotations/23.0.0/annotations-23.0.0.jar',
  ],
  [
    'collection.jar',
    'https://dl.google.com/dl/android/maven2/androidx/collection/collection-jvm/1.4.0/collection-jvm-1.4.0.jar',
  ],
  [
    'shapes-android.aar',
    'https://dl.google.com/dl/android/maven2/androidx/graphics/graphics-shapes-android/1.0.1/graphics-shapes-android-1.0.1.aar',
  ],
];
await Promise.all(
  artifacts.map(async ([name, url]) => {
    try {
      await readFile(`${dir}/${name}`);
      return;
    } catch {}
    const r = await fetch(url);
    if (!r.ok) throw Error(`${r.status}: ${url}`);
    await writeFile(`${dir}/${name}`, new Uint8Array(await r.arrayBuffer()));
    console.log('Downloaded', name);
  }),
);
execFileSync('jar', ['xf', 'shapes-android.aar', 'classes.jar'], { cwd: dir });
let original = await readFile('docs/references/compose-MaterialShapes.kt', 'utf8');
let body = original.slice(original.indexOf('public sealed class MaterialShapes'));
const header = `import androidx.graphics.shapes.*
import kotlin.math.*
data class Offset(val x: Float,val y: Float) {
 operator fun plus(o: Offset)=Offset(x+o.x,y+o.y)
 operator fun minus(o: Offset)=Offset(x-o.x,y-o.y)
 operator fun times(v: Float)=Offset(x*v,y*v)
 fun getDistance()=hypot(x,y)
 companion object { val Zero=Offset(0f,0f) }
}
class Matrix {
 var sx=1f; var sy=1f; var angle=0f
 fun scale(x:Float,y:Float) { sx=x; sy=y }
 fun rotateZ(z:Float) { angle=z/180f*PI.toFloat() }
}
fun RoundedPolygon.transformed(m:Matrix):RoundedPolygon = transformed { x,y ->
 val xx=x*m.sx; val yy=y*m.sy
 androidx.graphics.shapes.TransformResult(xx*cos(m.angle)-yy*sin(m.angle),xx*sin(m.angle)+yy*cos(m.angle))
}
inline fun <T,R> List<T>.fastMap(transform:(T)->R)=map(transform)
`;
// The official TransformResult type is a packed Point; use a Pair on public PointTransformer API.
const patchedHeader = header.replace(
  'androidx.graphics.shapes.TransformResult(',
  'androidx.collection.FloatFloatPair(',
);
const names = [...original.matchAll(/public val (\w+): RoundedPolygon/g)].map((x) => x[1]);
const main =
  `\nfun main() {\n println("{")\n` +
  names
    .map(
      (n, i) =>
        ` run { val p=MaterialShapes.${n}; println("\\\"${n[0].toLowerCase() + n.slice(1)}\\\":["+p.cubics.joinToString(","){c -> listOf(c.anchor0X,c.anchor0Y,c.control0X,c.control0Y,c.control1X,c.control1Y,c.anchor1X,c.anchor1Y).joinToString(",", "[", "]")}+"]${i < names.length - 1 ? ',' : ''}") }`,
    )
    .join('\n') +
  '\n println("}")\n}\n';
await writeFile(`${dir}/Export.kt`, patchedHeader + body + main);
const jars = artifacts.filter(([n]) => n.endsWith('.jar')).map(([n]) => `${dir}/${n}`);
const cp = [...jars, `${dir}/classes.jar`].join(delimiter);
execFileSync(
  'java',
  [
    '-cp',
    cp,
    'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
    '-no-stdlib',
    '-no-reflect',
    '-classpath',
    cp,
    '-d',
    `${dir}/export.jar`,
    `${dir}/Export.kt`,
  ],
  { stdio: 'inherit' },
);
const result = execFileSync(
  'java',
  ['-cp', [`${dir}/export.jar`, cp].join(delimiter), 'ExportKt'],
  { encoding: 'utf8' },
);
const shapes = JSON.parse(result);
await mkdir('packages/shape/src', { recursive: true });
await writeFile(
  'packages/shape/src/material-shapes.ts',
  '// Copyright 2024 The Android Open Source Project. Apache-2.0.\n// Generated from pinned MaterialShapes.kt using androidx.graphics:graphics-shapes:1.0.1.\n// See scripts/export-shapes.mjs, docs/references/sources.json and NOTICE.\nexport const materialShapes = ' +
    JSON.stringify(shapes, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)) +
    ' as const;\n',
);
console.log('Exported', Object.keys(shapes).length, 'official cubic outlines.');
