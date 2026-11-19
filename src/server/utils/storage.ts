import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

export function ensureUploadSubdir(subdir: 'materials' | 'question-images'): string {
  const target = path.join(BASE_UPLOAD_DIR, subdir);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'file';
}

export function saveLocalUpload(
  subdir: 'materials' | 'question-images',
  originalName: string,
  buffer: Buffer
): { storageKey: string; fileName: string; storageProvider: 'local' } {
  const dir = ensureUploadSubdir(subdir);
  const safeName = sanitizeFilename(originalName);
  const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;
  const fullPath = path.join(dir, uniqueName);
  fs.writeFileSync(fullPath, buffer);
  return {
    storageKey: `${subdir}/${uniqueName}`,
    fileName: safeName,
    storageProvider: 'local',
  };
}

export function resolveSafeLocalPath(storageKey: string): string | null {
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(BASE_UPLOAD_DIR, normalized);
  if (!fullPath.startsWith(BASE_UPLOAD_DIR)) {
    return null;
  }
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fullPath;
}

export function deleteLocalUpload(storageKey: string): void {
  const fullPath = resolveSafeLocalPath(storageKey);
  if (fullPath && fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}
