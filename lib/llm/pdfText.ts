type PdfJsTextItem = { str: string; transform: number[] };

interface PdfJsPage {
  getTextContent: () => Promise<{ items: PdfJsTextItem[] }>;
}

interface PdfJsDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
}

interface PdfJsLib {
  getDocument: (opts: unknown) => { promise: Promise<PdfJsDocument> };
}

async function extractWithPdfJs(buffer: Buffer, maxPages: number): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as PdfJsLib;
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8, verbosity: 0 }).promise;

  try {
    const pageTexts: string[] = [];
    const pageLimit = Math.min(doc.numPages, maxPages);

    for (let i = 1; i <= pageLimit; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      const lines: string[] = [];
      let currentLine = '';

      for (const item of content.items) {
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = item.str;
        } else {
          currentLine += (currentLine && item.str && !currentLine.endsWith(' ') ? ' ' : '') + item.str;
        }
        lastY = y;
      }

      if (currentLine.trim()) lines.push(currentLine.trim());
      pageTexts.push(lines.join('\n'));
    }

    return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
  } finally {
    await doc.destroy();
  }
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromPdfBuffer(buffer: Buffer, maxPages = 30): Promise<string> {
  try {
    const text = await extractWithPdfJs(buffer, maxPages);
    if (text.trim()) return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[pdfText] pdfjs extraction failed, falling back:', message);
  }

  const fallbackText = await extractWithPdfParse(buffer);
  if (fallbackText.trim()) return fallbackText;
  throw new Error('Unable to extract text from PDF');
}
