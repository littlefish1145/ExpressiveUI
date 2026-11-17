import { describe, expect, it } from 'vitest';
import { restoreDraft } from '../../playground/src/api/drafts.js';
import { exampleFor } from '../../playground/src/api/examples.js';

describe('Studio npm scope migration', () => {
  it('preserves user edits and updates personal-scope imports in saved drafts', () => {
    const canonical = exampleFor('components/button');
    const saved = {
      ...canonical,
      ts: "import {enhanceButton} from '@amiracle1024/components'; // edited",
      react: "import {Button} from '@amiracle1024/adapter-react';",
      css: 'button { color: red }',
      cdn: '<!-- saved CDN -->',
    };
    const restored = restoreDraft(canonical, saved);
    expect(restored.ts).toBe("import {enhanceButton} from '@epui/components'; // edited");
    expect(restored.react).toContain("'@epui/adapter-react'");
    expect(restored.css).toBe(saved.css);
    expect(restored.cdn).toBe(saved.cdn);
    expect(saved.ts).toContain('@amiracle1024/');
  });
  it('ignores invalid drafts and retains current canonical metadata', () => {
    const canonical = exampleFor('components/button');
    expect(restoreDraft(canonical, { ts: 'partial' })).toBe(canonical);
    const restored = restoreDraft(canonical, { ...canonical, notes: 'stale metadata', cdn: 42 });
    expect(restored.notes).toBe(canonical.notes);
    expect(restored.cdn).toBeUndefined();
  });
});
