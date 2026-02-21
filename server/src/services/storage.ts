import fs from 'fs/promises';
import fsSync from 'fs';
import nodePath from 'path';
import { env } from '../config/env.js';

const uploadsDir = nodePath.resolve(env.UPLOADS_DIR);

if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
}

export async function uploadFile(
  _bucket: string,
  filePath: string,
  buffer: Buffer,
  _contentType: string
): Promise<string> {
  const dest = nodePath.join(uploadsDir, filePath);
  await fs.mkdir(nodePath.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
  return `/uploads/${filePath}`;
}

export async function deleteFile(_bucket: string, filePath: string): Promise<void> {
  const dest = nodePath.join(uploadsDir, filePath);
  await fs.unlink(dest).catch(() => undefined);
}
