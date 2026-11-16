/** User-triggered in-page audit. axe-core is a dev dependency loaded only here. */
export async function auditAccessibility() {
  const { default: axe } = await import('axe-core');
  const result = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    },
  });
  return {
    engine: result.testEngine,
    url: result.url,
    timestamp: result.timestamp,
    violations: result.violations.map((rule) => ({
      id: rule.id,
      impact: rule.impact,
      help: rule.help,
      helpUrl: rule.helpUrl,
      nodes: rule.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        summary: node.failureSummary,
      })),
    })),
    incomplete: result.incomplete.map((rule) => ({
      id: rule.id,
      help: rule.help,
      nodes: rule.nodes.map((node) => ({ target: node.target, html: node.html })),
    })),
    passes: result.passes.length,
  };
}
