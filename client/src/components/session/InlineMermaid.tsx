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

// ── Sanitise code before parsing ─────────────────────────────────────────────
function sanitiseMermaidCode(code: string): string {
  let s = code
    // Strip display math $$...$$ — keep inner text
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, b) => b.trim())
    // Strip inline math $...$ — keep inner text
    .replace(/\$([^$\n]+)\$/g, '$1')
    // Unwrap \ce{...} — keep inner text
    .replace(/\\ce\{([^}]*)\}/g, '$1')
    // Unwrap other \cmd{content} — keep content
    .replace(/\\[A-Za-z]+\{([^}]*)\}/g, '$1')
    // Remove bare \commands (\Delta, \alpha, \frac, etc.)
    .replace(/\\[A-Za-z]+/g, '')
    // Remove any stray $ remaining
    .replace(/\$/g, '')
    // Replace Unicode sub/superscripts used in chemical formulas with ASCII
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, d => String('0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(d)]))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, d => String('0123456789'['⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d)]))
    .replace(/[⁺⁻]/g, d => d === '⁺' ? '+' : '-')
    // Replace equilibrium arrows with plain ASCII arrows mermaid understands
    .replace(/⇌/g, '<-->').replace(/→/g, '-->').replace(/←/g, '<--');

  // Fix nested [ ] inside rectangular node labels — parser chokes on them.
  // e.g.  C[Increase [H3O+], [OH-]]  →  C[Increase (H3O+), (OH-)]
  s = s.replace(
    /(\b\w+\s*)\[([^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*)\]/g,
    (_, nodeId, label) => `${nodeId}[${label.replace(/\[([^\[\]]*)\]/g, '($1)')}]`,
  );

  // Ensure node labels with + or - that look like bare ion formulas are quoted.
  // e.g.  A[H3O+]  →  A["H3O+"]   (prevents + being parsed as an operator)
  s = s.replace(
    /(\b\w+\s*)\[([^\]"]*[+\-][^\]"]*)\]/g,
    (_, nodeId, label) => `${nodeId}["${label.trim()}"]`,
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
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\(\[/g))          add(m[1], 'terminal');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\(\(/g))          add(m[1], 'terminal');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[\(/g))          add(m[1], 'database');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\{/g))            add(m[1], 'decision');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\[[\\/]/g))       add(m[1], 'io');
  for (const m of code.matchAll(/\b([A-Za-z_][\w]*)\s*\((?!\[|\()/g))   add(m[1], 'io');
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

// Mermaid v11 sometimes resolves (not rejects) with a "Syntax error" SVG.
function isMermaidErrorSvg(svg: string) {
  const l = svg.toLowerCase();
  return l.includes('syntax error') || l.includes('parse error') || l.includes('mermaid version');
}

// ── Safe render helper ────────────────────────────────────────────────────────
// Passes an owned container as svgContainingElement so Mermaid never injects
// error output into document.body.  The container is removed in `finally`
// regardless of success or failure.
async function safeRender(
  m: Awaited<ReturnType<typeof getMermaid>>,
  renderId: string,
  code: string,
): Promise<string | null> {
  const container = document.createElement('div');
  container.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px';
  document.body.appendChild(container);
  try {
    const result = await m.render(renderId, code, container);
    const svg = result?.svg ?? '';
    return isMermaidErrorSvg(svg) ? null : svg || null;
  } catch {
    return null;
  } finally {
    container.remove();
  }
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

    getMermaid().then(async m => {
      // Attempt 1: with semantic colour classes
      let result = await safeRender(m, id, addSemanticClasses(clean));
      // Attempt 2: plain sanitised code (no classDef injection)
      if (!result) result = await safeRender(m, id, clean);
      if (!cancelled) {
        if (result) setSvg(result);
        else setError(true);
      }
    }).catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; };
  }, [id, code]);

  // Silently suppress failed diagrams — showing an error inside lesson content
  // is more disruptive than simply omitting the visual.
  if (error) return null;

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
