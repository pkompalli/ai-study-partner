'use client'

export function ExportPDFButton({ title, content }: { title: string; content: string }) {
  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; line-height: 1.6; }
            h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
            h2 { font-size: 1.4rem; margin-top: 2rem; }
            h3 { font-size: 1.1rem; margin-top: 1.5rem; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
            code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div id="content"></div>
          <script>
            document.getElementById('content').innerHTML = ${JSON.stringify(content)};
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <button
      onClick={handlePrint}
      className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Export PDF
    </button>
  )
}
