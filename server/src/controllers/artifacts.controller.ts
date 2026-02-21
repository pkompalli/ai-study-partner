import type { Request, Response, NextFunction } from 'express';
import { getArtifact, listArtifacts, updateArtifactPdfUrl } from '../db/artifacts.db.js';
import { renderMarkdownToPDF } from '../services/export.js';
import { uploadFile } from '../services/storage.js';

export async function getArtifactById(req: Request, res: Response, next: NextFunction) {
  try {
    const artifact = getArtifact(req.params['id'] as string, req.user!.id);
    res.json(artifact);
  } catch (err) {
    next(err);
  }
}

export async function getArtifacts(req: Request, res: Response, next: NextFunction) {
  try {
    const artifacts = listArtifacts(req.user!.id, req.query['sessionId'] as string | undefined);
    res.json(artifacts);
  } catch (err) {
    next(err);
  }
}

export async function exportPDF(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const artifactId = req.params['id'] as string;
    const artifact = getArtifact(artifactId, userId);

    const pdfBuffer = await renderMarkdownToPDF(artifact.markdown_content, artifact.title);
    const filePath = `${userId}/${artifactId}.pdf`;
    const pdfUrl = await uploadFile('lesson-artifacts', filePath, pdfBuffer, 'application/pdf');

    updateArtifactPdfUrl(artifactId, pdfUrl);
    res.json({ pdfUrl });
  } catch (err) {
    next(err);
  }
}
