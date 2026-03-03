'use client'
import { useCallback, useEffect, useId, useState } from 'react';

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

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;

// ── Component ─────────────────────────────────────────────────────────────────
export function InlineMermaid({ code }: { code: string }) {
  const uid = useId().replace(/:/g, '');
  const id  = `mermaid-${uid}`;
  const [svg,   setSvg]   = useState<string>('');
  const [error, setError] = useState(false);
  const [zoom,  setZoom]  = useState(1);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setSvg('');
    setZoom(1);

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

  const zoomIn  = useCallback(() => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // Silently suppress failed diagrams — showing an error inside lesson content
  // is more disruptive than simply omitting the visual.
  if (error) return null;

  if (!svg) {
    return <div className="min-h-24 rounded-2xl bg-slate-50 animate-pulse my-4" />;
  }

  // Inject white background into the SVG. Do NOT set width:100% — let SVG keep
  // its natural dimensions so CSS zoom actually works.
  const renderedSvg = svg.replace(
    /<svg\b/,
    '<svg style="background:white;display:block;min-height:80px;max-width:100%"',
  );

  const zoomPct = Math.round(zoom * 100);

  return (
    // not-prose: escape Tailwind Typography so prose rules don't dark-style the SVG
    <div className="not-prose my-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
      {/* Zoom toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
        <button
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-opacity text-slate-500"
          title="Zoom out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button
          onClick={zoomReset}
          className="text-xs text-slate-400 hover:text-slate-600 tabular-nums px-1 min-w-[40px] text-center"
          title="Reset zoom"
        >
          {zoomPct}%
        </button>
        <button
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-opacity text-slate-500"
          title="Zoom in"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
      </div>
      {/* Diagram container — scrollable when zoomed in */}
      <div className="overflow-auto max-h-[70vh]">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          dangerouslySetInnerHTML={{ __html: renderedSvg }}
        />
      </div>
    </div>
  );
}
