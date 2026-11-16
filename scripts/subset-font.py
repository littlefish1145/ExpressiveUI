"""Preserve the official variable font outlines/axes; split Unicode coverage for loading."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
directory = root / 'packages/components/src/fonts'
source = directory / 'Roboto-variable.woff2'
font = TTFont(source)
coverage = set(font.getBestCmap())
latin = {c for c in coverage if c <= 0x024F or 0x2000 <= c <= 0x206F or c in (0x20AC, 0x2122, 0x2212)}
other = coverage - latin
rules = []
for name, points in [('latin', latin), ('extended', other)]:
    options = subset.Options()
    options.flavor = 'woff2'
    options.name_IDs = ['*']
    options.name_legacy = True
    font = TTFont(source)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=points)
    subsetter.subset(font)
    font.flavor = 'woff2'
    target = directory / f'Roboto-{name}.woff2'
    font.save(target)
    # Compact, exact coverage prevents Chinese text triggering an unrelated font download.
    runs=[]
    for value in sorted(points):
        if runs and value == runs[-1][1] + 1: runs[-1][1] = value
        else: runs.append([value,value])
    ranges=','.join(f'U+{a:X}' if a==b else f'U+{a:X}-{b:X}' for a,b in runs)
    rules.append(f"@font-face {{font-family:'Expressive Roboto';src:url('./fonts/Roboto-{name}.woff2') format('woff2');font-style:normal;font-weight:100 900;font-stretch:75% 100%;font-display:swap;unicode-range:{ranges};}}")
    print(f'{target.name}: {target.stat().st_size} B, {len(points)} codepoints')
(directory.parent / 'fonts.css').write_text('\n'.join(rules)+"\n@layer expressive-ui {:root {--eui-font-family:'Expressive Roboto',Roboto,Arial,sans-serif;}}\n",encoding='utf8')
