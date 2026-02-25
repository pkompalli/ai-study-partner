import { useEffect, useId, useState } from 'react';

// ── Semantic colour palette ───────────────────────────────────────────────────
const SEMANTIC: Record<string, string> = {
  terminal: 'fill:#6366f1,stroke:#4338ca,color:#fff,stroke-width:2px',
  decision: 'fill:#f59e0b,stroke:#b45309,color:#fff,stroke-width:2px',
  process:  'fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px',
  io:       'fill:#10b981,stroke:#065f46,color:#fff,stroke-width:2px',
  database: 'fill:#8b5cf6,stroke:#5b21b6,color:#fff,stroke-width:2px',
};

const KEYWORDS = new Set([
  'subgraph', 'classDef', 'class', 'style', 'linkStyle',
  'click', 'end', 'direction', 'LR', 'RL', 'TB', 'TD', 'BT',
]);

// ── Sanitise Mermaid code before parsing ─────────────────────────────────────
// The LLM often puts LaTeX / nested brackets inside node labels which breaks
// the Mermaid parser. Strip / fix all of those defensively.
function sanitiseMermaidCode(code: string): string {
  let s = code
    // Remove display math $$...$$ — keep inner text
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, b) => b.trim())
    // Remove inline math $...$ — keep inner text
    .replace(/\$([^$\n]+)\$/g, '$1')
    // Remove \ce{...} — keep inner text
    .replace(/\\ce\{([^}]*)\}/g, '$1')
    // Remove other \cmd{content} — keep content
    .replace(/\\[A-Za-z]+\{([^}]*)\}/g, '$1')
    // Remove bare \commands like \Delta, \alpha, \frac etc.
    .replace(/\\[A-Za-z]+/g, '')
    // Remove any stray $ that remain
    .replace(/\$/g, '');

  // Fix nested [ ] inside rectangular node labels.
  // e.g.  C[Increase [H3O+], [OH-]]  →  C[Increase (H3O+), (OH-)]
  // The outer [label] is the node shape; inner [ ] break the parser.
  s = s.replace(
    /(\b\w+\s*)\[([^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*)\]/g,
    (_, nodeId, label) => {
      // Replace any remaining [ ] inside the label with ( )
      const fixed = label.replace(/\[([^\[\]]*)\]/g, '($1)');
      return `${nodeId}[${fixed}]`;
    },
  );

  return s;
}

// ── Semantic classDef injection ───────────────────────────────────────────────
function detectNodeCategories(code: string): Map<string, string> {
  const cats = new Map<string, string>();
  function add(id: string, cat: string) {
    if (!id || KEYWORDS.has(id) || cats.has(id)) return;
    cats.set(id, cat);
  }
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\(\[/g))  add(m[1], 'terminal');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\(\(/g))  add(m[1], 'terminal');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[\(/g))  add(m[1], 'database');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\{/g))    add(m[1], 'decision');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[[\\/]/g)) add(m[1], 'io');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\((?!\[|\()/g)) add(m[1], 'io');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[(?![(\\\/])/g)) add(m[1], 'process');
  return cats;
}

function addSemanticClasses(code: string): string {
  const trimmed = code.trim();
  if (!/^(flowchart|graph)\s/mi.test(trimmed)) return trimmed;
  if (/\bclassDef\b/i.test(trimmed)) return trimmed;

  const cats = detectNodeCategories(trimmed);
  if (cats.size === 0) return trimmed;

  const usedCats = new Set(cats.values());
  const defs = [...usedCats].map(c => `  classDef ${c} ${SEMANTIC[c]}`).join('\n');

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

// ── Mermaid singleton ─────────────────────────────────────────────────────────
let initPromise: Promise<typeof import('mermaid').default> | null = null;

function getMermaid() {
  if (!initPromise) {
    initPromise = import('mermaid').then(m => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
          primaryColor:        '#eff6ff',
          primaryTextColor:    '#1e3a5f',
          primaryBorderColor:  '#93c5fd',
          lineColor:           '#64748b',
          edgeLabelBackground: '#f8fafc',
          secondaryColor:      '#f0fdf4',
          tertiaryColor:       '#fefce8',
          clusterBkg:          '#f8fafc',
          clusterBorder:       '#cbd5e1',
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          fontSize:   '14px',
        },
        flowchart: { curve: 'basis', htmlLabels: true, padding: 18 },
      });
      return m.default;
    });
  }
  return initPromise;
}

// Remove any orphaned Mermaid elements left in the DOM after a failed render.
// Mermaid v11 creates #d<id> wrappers in the body that it doesn't always clean up.
function purgeMermaidElements(id: string) {
  document.getElementById(id)?.remove();
  document.getElementById(`d${id}`)?.remove();
}

// Mermaid v11 sometimes resolves (rather than rejects) with an SVG that contains
// the error text. Detect that so we can fall through to a nicer fallback.
function isMermaidErrorSvg(svg: string) {
  return svg.includes('Syntax error') || svg.includes('mermaid version');
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

    const clean = sanitiseMermaidCode(code);

    async function render(m: Awaited<ReturnType<typeof getMermaid>>) {
      // 1. Try with semantic class injection
      try {
        const r = await m.render(id, addSemanticClasses(clean));
        if (!isMermaidErrorSvg(r.svg)) return r.svg;
      } catch { /* fall through */ }
      purgeMermaidElements(id);

      // 2. Fall back to plain sanitised code (no classDef)
      try {
        const r = await m.render(id, clean);
        if (!isMermaidErrorSvg(r.svg)) return r.svg;
      } catch { /* fall through */ }
      purgeMermaidElements(id);

      return null; // signal failure
    }

    getMermaid()
      .then(m => render(m))
      .then(result => {
        if (cancelled) return;
        if (result) setSvg(result);
        else setError(true);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      purgeMermaidElements(id);
    };
  }, [id, code]);

  if (error) {
    // Quiet fallback — show a neutral placeholder rather than the raw code
    return (
      <div className="my-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400 italic">
        Diagram unavailable
      </div>
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
        '[&_svg]:max-w-full',
        '[&_.edgeLabel]:text-xs [&_.edgeLabel]:font-medium',
        '[&_foreignObject]:overflow-visible',
        'max-h-[80vh] overflow-y-auto',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
