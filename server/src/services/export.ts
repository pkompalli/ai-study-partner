import puppeteer from 'puppeteer';

export async function renderMarkdownToPDF(
  markdown: string,
  title: string
): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Convert markdown to simple HTML (use marked-style basic conversion)
  const html = markdownToHTML(markdown, title);
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
  });

  await browser.close();
  return Buffer.from(pdf);
}

function markdownToHTML(markdown: string, title: string): string {
  // Basic markdown → HTML conversion (headers, bold, lists, code)
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/(<li>.*<\/li>)+/gs, match => `<ul>${match}</ul>`);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(title)}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.7; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
    h2 { color: #1d4ed8; margin-top: 32px; }
    h3 { color: #2563eb; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    ul { padding-left: 24px; }
    li { margin-bottom: 6px; }
    strong { color: #1e293b; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
