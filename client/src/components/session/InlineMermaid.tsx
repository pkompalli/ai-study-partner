import { useEffect, useId, useState } from 'react';

// ── Semantic colour palette ───────────────────────────────────────────────────
// Each node shape gets a meaningful colour so diagrams are self-explanatory at
// a glance without the reader needing to decode shape conventions alone.
const SEMANTIC: Record<string, string> = {
  terminal: 'fill:#6366f1,stroke:#4338ca,color:#fff,stroke-width:2px',   // indigo  — start / end
  decision: 'fill:#f59e0b,stroke:#b45309,color:#fff,stroke-width:2px',   // amber   — diamonds / conditions
  process:  'fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px',   // blue    — rectangles / steps
  io:       'fill:#10b981,stroke:#065f46,color:#fff,stroke-width:2px',   // teal    — rounded / parallelogram
  database: 'fill:#8b5cf6,stroke:#5b21b6,color:#fff,stroke-width:2px',   // purple  — cylinders / storage
};

// Words that look like node IDs but are Mermaid keywords
const KEYWORDS = new Set([
  'subgraph', 'classDef', 'class', 'style', 'linkStyle',
  'click', 'end', 'direction', 'LR', 'RL', 'TB', 'TD', 'BT',
]);

// ── Shape → semantic category ─────────────────────────────────────────────────
function detectNodeCategories(code: string): Map<string, string> {
  const cats = new Map<string, string>();

  function add(id: string, cat: string) {
    if (!id || KEYWORDS.has(id) || cats.has(id)) return;
    cats.set(id, cat);
  }

  // Terminal — stadium  nodeId([   or double-circle  nodeId((
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\(\[/g))  add(m[1], 'terminal');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\(\(/g))  add(m[1], 'terminal');

  // Database — cylinder  nodeId[(
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[\(/g))  add(m[1], 'database');

  // Decision — diamond  nodeId{   (hexagon nodeId{{ is also treated as decision)
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\{/g))    add(m[1], 'decision');

  // I/O — parallelogram  nodeId[/  or  nodeId[\
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[[\\/]/g)) add(m[1], 'io');

  // I/O — rounded rect  nodeId(   (but NOT  ((  or  ([  already captured above)
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\((?!\[|\()/g)) add(m[1], 'io');

  // Process — plain rectangle  nodeId[   (but NOT  [(  or  [/  or  [\  already captured)
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[(?![(\\\/])/g)) add(m[1], 'process');

  return cats;
}

// ── Inject classDef + class statements ───────────────────────────────────────
function addSemanticClasses(code: string): string {
  const trimmed = code.trim();
  // Only flowchart / graph diagrams support classDef
  if (!/^(flowchart|graph)\s/mi.test(trimmed)) return trimmed;
  // Respect diagrams the author already styled
  if (/\bclassDef\b/i.test(trimmed)) return trimmed;

  const cats = detectNodeCategories(trimmed);
  if (cats.size === 0) return trimmed;

  const usedCats = new Set(cats.values());
  const defs = [...usedCats]
    .map(c => `  classDef ${c} ${SEMANTIC[c]}`)
    .join('\n');

  const byClass = new Map<string, string[]>();
  for (const [id, c] of cats) {
    if (!byClass.has(c)) byClass.set(c, []);
    byClass.get(c)!.push(id);
  }
  const assigns = [...byClass.entries()]
    .map(([c, ids]) => `  class ${ids.join(',')} ${c}`)
    .join('\n');

  return `${trimmed}\n${defs}\n${assigns}`;
}

// ── Singleton initialisation — avoids race condition with parallel renders ────
let initPromise: Promise<typeof import('mermaid').default> | null = null;

function getMermaid() {
  if (!initPromise) {
    initPromise = import('mermaid').then(m => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
          // Unclassified nodes — light blue tint with dark text
          primaryColor:        '#eff6ff',
          primaryTextColor:    '#1e3a5f',
          primaryBorderColor:  '#93c5fd',
          // Edges
          lineColor:           '#64748b',
          // Edge label chip
          edgeLabelBackground: '#f8fafc',
          // Secondary / tertiary fill (used in some diagram types)
          secondaryColor:      '#f0fdf4',
          tertiaryColor:       '#fefce8',
          // Subgraph cluster
          clusterBkg:          '#f8fafc',
          clusterBorder:       '#cbd5e1',
          // Typography
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          fontSize:   '14px',
        },
        flowchart: {
          curve:      'basis',   // smooth bezier edges
          htmlLabels: true,
          padding:    18,
        },
      });
      return m.default;
    });
  }
  return initPromise;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function InlineMermaid({ code }: { code: string }) {
  const uid = useId().replace(/:/g, '');
  const id  = `mermaid-${uid}`;
  const [svg,   setSvg]   = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setSvg('');

    getMermaid()
      .then(async m => {
        // Try with semantic colours first; fall back to plain code if classDef
        // injection caused a parse error (e.g. unexpected diagram type).
        try {
          return await m.render(id, addSemanticClasses(code));
        } catch {
          return await m.render(id, code);
        }
      })
      .then(({ svg: rendered }) => { if (!cancelled) setSvg(rendered); })
      .catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; };
  }, [id, code]);

  if (error) {
    return (
      <pre className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 overflow-x-auto my-2">
        {code}
      </pre>
    );
  }

  if (!svg) {
    return <div className="min-h-24 rounded-2xl bg-slate-50 animate-pulse my-4" />;
  }

  return (
    <div
      className={[
        'my-4 overflow-x-auto rounded-2xl p-5',
        'border border-slate-100 bg-white shadow-sm',
        // Let SVG keep its intrinsic height; only cap the width.
        // Do NOT set h-auto — it collapses SVGs with relative height to 0.
        '[&_svg]:max-w-full',
        // Smooth edge labels
        '[&_.edgeLabel]:text-xs [&_.edgeLabel]:font-medium',
        '[&_foreignObject]:overflow-visible',
        // Prevent runaway-tall diagrams from filling the page
        'max-h-[80vh] overflow-y-auto',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
