import ts from 'typescript';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
const names = ['core', 'tokens', 'shape', 'motion', 'theme', 'components', 'adapter-react'];
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const entries = names.map((name) =>
  resolve(`packages/${name}/src/index.${name === 'adapter-react' ? 'tsx' : 'ts'}`),
);
const program = ts.createProgram(entries, {
  ...parsed.options,
  noEmit: false,
  declaration: true,
  emitDeclarationOnly: true,
  outDir: resolve('.cache/api-declarations'),
});
const checker = program.getTypeChecker(),
  declarations = new Map();
program.emit(
  undefined,
  (file, text, bom, error, sources) => {
    if (file.endsWith('.d.ts'))
      for (const source of sources ?? []) declarations.set(resolve(source.fileName), text);
  },
  undefined,
  true,
);
const flags =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
const typeText = (type, node) => checker.typeToString(type, node, flags);
const documentation = (symbol) => ts.displayPartsToString(symbol.getDocumentationComment(checker));
function members(type, node) {
  return checker
    .getPropertiesOfType(type)
    .filter(
      (symbol) =>
        !symbol.name.startsWith('__@') &&
        !symbol
          .getDeclarations()
          ?.some((declaration) => declaration.name && ts.isPrivateIdentifier(declaration.name)),
    )
    .map((symbol) => ({
      name: symbol.name,
      type: typeText(
        checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? node),
        node,
      ),
      optional: !!(symbol.flags & ts.SymbolFlags.Optional),
      description: documentation(symbol),
    }));
}
const pages = new Map(),
  exports = [];
const eventRows = [];
for (const source of program
  .getSourceFiles()
  .filter((source) =>
    source.fileName.replaceAll('\\', '/').includes('/packages/components/src/'),
  )) {
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'emit' &&
      node.arguments[1] &&
      ts.isStringLiteral(node.arguments[1]) &&
      node.arguments[1].text.startsWith('eui-')
    )
      eventRows.push({
        name: node.arguments[1].text,
        type: node.arguments[2]
          ? typeText(checker.getTypeAtLocation(node.arguments[2]), node)
          : 'undefined',
        description: `${basename(source.fileName)} · cancelable: ${node.arguments[3]?.getText(source) ?? 'false'}`,
      });
    ts.forEachChild(node, visit);
  };
  visit(source);
}
for (const [i, entry] of entries.entries()) {
  const source = program.getSourceFile(entry),
    module = checker.getSymbolAtLocation(source);
  for (let symbol of checker.getExportsOfModule(module)) {
    const exportedName = symbol.name;
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const node =
      symbol
        .getDeclarations()
        ?.find(
          (node) =>
            node.getSourceFile().fileName.includes(`/packages/${names[i]}/`) ||
            node.getSourceFile().fileName.includes(`\\packages\\${names[i]}\\`),
        ) ?? symbol.getDeclarations()?.[0];
    if (!node) continue;
    let file = resolve(node.getSourceFile().fileName);
    // Cross-package type re-exports stay documented under the exporting package's index.
    if (!file.startsWith(resolve(`packages/${names[i]}/src`))) file = entry;
    const id = names[i] + '/' + basename(file).replace(/\.tsx?$/, '');
    if (!pages.has(id))
      pages.set(id, {
        id,
        package: names[i],
        module: basename(file).replace(/\.tsx?$/, ''),
        source: relative(process.cwd(), file).replaceAll('\\', '/'),
        declaration: declarations.get(file) ?? '',
        symbols: [],
      });
    const type =
      symbol.flags & ts.SymbolFlags.Type && !(symbol.flags & ts.SymbolFlags.Value)
        ? checker.getDeclaredTypeOfSymbol(symbol)
        : checker.getTypeOfSymbolAtLocation(symbol, node);
    const signatures = ts.isClassDeclaration(node)
      ? type.getConstructSignatures()
      : type.getCallSignatures();
    const kind = ts.isInterfaceDeclaration(node)
      ? 'interface'
      : ts.isTypeAliasDeclaration(node)
        ? 'type'
        : ts.isClassDeclaration(node)
          ? 'class'
          : signatures.length
            ? 'function'
            : 'value';
    const model = {
      name: exportedName,
      kind,
      description: documentation(symbol),
      type: typeText(type, node),
      signatures: signatures.map((signature) => checker.signatureToString(signature, node, flags)),
      members:
        kind === 'interface' || kind === 'class'
          ? members(
              ts.isClassDeclaration(node) ? checker.getDeclaredTypeOfSymbol(symbol) : type,
              node,
            )
          : [],
      parameters: [],
      returns: [],
    };
    if (signatures[0]) {
      model.parameters = signatures[0].getParameters().map((parameter) => {
        const declaration = parameter.valueDeclaration ?? node;
        const type = checker.getTypeOfSymbolAtLocation(parameter, declaration);
        return {
          name: parameter.name,
          type: typeText(type, node),
          description: documentation(parameter),
          optional: !!declaration.questionToken || !!declaration.initializer,
          defaultValue: declaration.initializer?.getText() ?? null,
          members:
            checker.getNonNullableType(type).flags &
              (ts.TypeFlags.Object | ts.TypeFlags.Intersection) &&
            /Options|Parameters|initial|options/.test(parameter.name + typeText(type, node))
              ? members(checker.getNonNullableType(type), node)
              : [],
        };
      });
      model.returns = members(checker.getReturnTypeOfSignature(signatures[0]), node).filter(
        (member) => !['then', 'catch', 'finally'].includes(member.name),
      );
    }
    pages.get(id).symbols.push(model);
    exports.push({ package: names[i], name: exportedName, page: id });
  }
}
await mkdir('playground/src/api/generated', { recursive: true });
const index = [];
for (const page of pages.values()) {
  page.symbols.sort((a, b) => a.name.localeCompare(b.name));
  page.events =
    page.package === 'components'
      ? eventRows.filter(
          (event) =>
            event.description.startsWith(page.module + '.ts') ||
            ([
              'dialog',
              'sheet',
              'menu',
              'tooltip',
              'search',
              'navigation',
              'fab-menu',
              'select',
            ].includes(page.module) &&
              event.description.startsWith('overlay.ts')),
        )
      : [];
  const defaults = Object.create(null);
  const source = program.getSourceFile(resolve(page.source));
  const scan = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
      ts.isPropertyAccessExpression(node.left) &&
      /^(options|initial)$/.test(node.left.expression.getText(source))
    ) {
      const key = node.left.name.text;
      const value = node.right.getText(source);
      if (!defaults[key]) defaults[key] = new Set();
      defaults[key].add(value);
    }
    ts.forEachChild(node, scan);
  };
  scan(source);
  for (const symbol of page.symbols)
    for (const row of [
      ...symbol.members,
      ...symbol.parameters.flatMap((parameter) => parameter.members),
    ])
      if (defaults[row.name])
        row.description +=
          (row.description ? ' ' : '') + '源码回退表达式：' + [...defaults[row.name]].join(' / ');
  if (!page.declaration) throw Error('Missing declarations for ' + page.id);
  const name = page.id.replace('/', '--') + '.json';
  await writeFile('playground/src/api/generated/' + name, JSON.stringify(page));
  index.push({
    id: page.id,
    package: page.package,
    module: page.module,
    file: name,
    symbols: page.symbols.map((symbol) => symbol.name),
  });
}
index.sort((a, b) => {
  const order = ['components', 'adapter-react', 'core', 'tokens', 'shape', 'motion', 'theme'];
  return order.indexOf(a.package) - order.indexOf(b.package) || a.module.localeCompare(b.module);
});
const css = [];
for (const file of (await readdir('packages/components/src')).filter((file) =>
  file.endsWith('.css'),
)) {
  const content = await readFile('packages/components/src/' + file, 'utf8');
  for (const name of new Set(content.match(/--eui-[a-z0-9-]+/g) ?? []))
    css.push({ name, type: 'CSS Custom Property', description: file });
}
const cssMap = new Map();
for (const row of css) {
  const old = cssMap.get(row.name);
  if (old) old.description += ', ' + row.description;
  else cssMap.set(row.name, row);
}
const stylePage = {
  id: 'styles/variables',
  package: 'styles',
  module: 'variables',
  source: 'packages/components/src/*.css',
  declaration: '公开的 --eui-* 覆盖变量从当前 CSS 提取；--_eui-* 与 --_* 为私有实现。',
  symbols: [
    {
      name: 'CSSCustomProperties',
      kind: 'reference',
      description: '公开 CSS 覆盖点；具体回退以对应 CSS 文件与当前主题为准。',
      type: '--eui-*',
      signatures: [],
      members: [...cssMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      parameters: [],
      returns: [],
    },
  ],
  events: eventRows,
};
await writeFile('playground/src/api/generated/styles--variables.json', JSON.stringify(stylePage));
index.push({
  id: stylePage.id,
  package: 'styles',
  module: 'variables',
  file: 'styles--variables.json',
  symbols: ['CSSCustomProperties'],
});
await writeFile('playground/src/api/generated/index.json', JSON.stringify(index));
await writeFile(
  'docs/api-coverage.json',
  JSON.stringify(
    { packages: names, pages: index.length, exports: exports.length, items: exports },
    null,
    2,
  ) + '\n',
);
console.log(
  `Generated ${index.length} API pages covering all ${exports.length} public exports in ${names.length} packages.`,
);
