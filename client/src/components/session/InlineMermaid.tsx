import { useEffect, useId, useState } from 'react';

let mermaidReady = false;

async function getMermaid() {
  const m = await import('mermaid');
  if (!mermaidReady) {
    m.default.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
    mermaidReady = true;
  }
  return m.default;
}

export function InlineMermaid({ code }: { code: string }) {
  const uid = useId().replace(/:/g, '');
  const id = `mermaid-${uid}`;
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    getMermaid()
      .then(m => m.render(id, code))
      .then(({ svg }) => setSvg(svg))
      .catch(() => setError(true));
  }, [id, code]);

  if (error) {
    return (
      <pre className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 overflow-x-auto my-2">
        {code}
      </pre>
    );
  }

  if (!svg) {
    return <div className="h-16 rounded-lg bg-gray-50 animate-pulse my-2" />;
  }

  return (
    <div
      className="my-3 overflow-x-auto rounded-xl border border-gray-100 bg-white p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
