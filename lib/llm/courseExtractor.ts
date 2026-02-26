import { chatCompletion } from '@/lib/llm/client';
import { COURSE_EXTRACTOR_PROMPT, PDF_COURSE_EXTRACTOR_PROMPT } from '@/lib/llm/prompts';
import type { Subject } from '@/types';

export interface CourseStructure {
  name?: string;
  description?: string;
  subjects: Subject[];
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid module-level init errors in Next.js RSC environment
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8, verbosity: 0 }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Join items preserving rough layout: add newline when y position changes significantly
    let lastY: number | null = null;
    const lines: string[] = [];
    let currentLine = '';
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
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

  await doc.destroy();
  return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
}

export async function extractCourseFromText(text: string): Promise<CourseStructure> {
  const response = await chatCompletion([
    { role: 'system', content: COURSE_EXTRACTOR_PROMPT },
    { role: 'user', content: `Extract the course structure from this content:\n\n${text.slice(0, 12000)}` },
  ], { temperature: 0.3 });

  return parseStructureJSON(response);
}

export async function extractCourseFromPDF(buffer: Buffer): Promise<CourseStructure> {
  const rawText = await extractTextFromPDF(buffer);

  console.log(`[extractCourseFromPDF] extracted ${rawText.length} chars from PDF`);
  console.log('[extractCourseFromPDF] text preview (first 600):\n', rawText.slice(0, 600));

  const response = await chatCompletion([
    { role: 'system', content: PDF_COURSE_EXTRACTOR_PROMPT },
    { role: 'user', content: `Extract the course structure from this PDF text:\n\n${rawText.slice(0, 15000)}` },
  ], { temperature: 0.2, maxTokens: 4096 });

  return parseStructureJSON(response);
}

export async function extractCourseFromImages(images: { base64: string; mimeType: string }[]): Promise<CourseStructure> {
  const imageParts = images.map(img => ({
    type: 'image' as const,
    image: img.base64,
    mimeType: img.mimeType,
  }));

  console.log(`[extractCourseFromImages] sending ${images.length} image(s) to LLM`);

  const response = await chatCompletion([
    { role: 'system', content: COURSE_EXTRACTOR_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Extract the course structure from these ${images.length} image(s). They may be pages of a course syllabus or schedule:` },
        ...imageParts,
      ],
    },
  ], { temperature: 0.2, maxTokens: 4096 });

  return parseStructureJSON(response);
}

// Keep single-image variant for backwards compat
export async function extractCourseFromImage(base64: string, mimeType: string): Promise<CourseStructure> {
  return extractCourseFromImages([{ base64, mimeType }]);
}

export async function extractCourseFromJSON(jsonText: string): Promise<CourseStructure> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return extractCourseFromText(jsonText);
  }

  // If the JSON already matches our schema, validate and return
  const response = await chatCompletion([
    { role: 'system', content: COURSE_EXTRACTOR_PROMPT },
    { role: 'user', content: `Normalize and validate this course JSON:\n\n${JSON.stringify(parsed, null, 2).slice(0, 12000)}` },
  ], { temperature: 0.2 });

  return parseStructureJSON(response);
}

function parseStructureJSON(raw: string): CourseStructure {
  console.log('[courseExtractor] raw LLM response (first 500 chars):', raw.slice(0, 500));
  // Strip possible markdown code fences
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    console.log('[courseExtractor] parsed subjects count:', (parsed as { subjects?: unknown[] })?.subjects?.length ?? 0);
    return parsed as CourseStructure;
  } catch (e) {
    console.error('[courseExtractor] JSON parse failed:', e, '| cleaned (first 300):', cleaned.slice(0, 300));
    throw new Error('LLM returned invalid JSON for course structure');
  }
}
