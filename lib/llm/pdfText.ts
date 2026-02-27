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

interface PdfParseInstance {
  getText: () => Promise<{ text?: string }>;
  destroy: () => Promise<void>;
}

interface PdfParseCtor {
  new (opts: Record<string, unknown>): PdfParseInstance;
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  // Context7 troubleshooting guidance:
  // import CanvasFactory from pdf-parse/worker before importing pdf-parse in Node runtimes.
  const { CanvasFactory } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse') as unknown as { PDFParse: PdfParseCtor };
  const parser = new PDFParse({ data: buffer, CanvasFactory });

  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromPdfBuffer(buffer: Buffer, maxPages = 30): Promise<string> {
  try {
    const text = await extractWithPdfParse(buffer);
    if (text.trim()) return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[pdfText] pdf-parse extraction failed, falling back:', message);
  }

  try {
    const fallbackText = await extractWithPdfJs(buffer, maxPages);
    if (fallbackText.trim()) return fallbackText;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[pdfText] pdfjs fallback also failed:', message);
  }

  throw new Error('Unable to extract text from PDF');
}
