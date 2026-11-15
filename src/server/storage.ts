import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const PRIVATE_STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'private');

function getSigningSecret(): string {
  return (
    process.env.STORAGE_SIGNING_SECRET ||
    process.env.SQL_PASSWORD ||
    process.env.GEMINI_API_KEY ||
    'resumeai-private-storage-dev-key'
  );
}

function sanitizeSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'file';
}

function resolveSafeStoragePath(storagePath: string): string {
  const normalized = storagePath.replace(/^\/+/, '');
  const resolved = path.resolve(PRIVATE_STORAGE_ROOT, normalized);
  if (!resolved.startsWith(PRIVATE_STORAGE_ROOT + path.sep)) {
    throw new Error('Invalid private storage path.');
  }
  return resolved;
}

export async function savePrivateFile(
  relativeFolder: string,
  fileName: string,
  buffer: Buffer,
): Promise<{ storagePath: string; sizeBytes: number }> {
  const safeFolder = relativeFolder
    .split('/')
    .map((seg) => sanitizeSegment(seg))
    .join('/');
  const safeFile = `${Date.now()}_${sanitizeSegment(fileName)}`;
  const storagePath = `${safeFolder}/${safeFile}`;
  const fullPath = resolveSafeStoragePath(storagePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return {
    storagePath,
    sizeBytes: buffer.byteLength,
  };
}

export async function readPrivateFile(storagePath: string): Promise<Buffer | null> {
  try {
    const fullPath = resolveSafeStoragePath(storagePath);
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

export async function deletePrivateFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    const fullPath = resolveSafeStoragePath(storagePath);
    await fs.unlink(fullPath);
  } catch {
    // Ignore missing files on cleanup
  }
}

export async function getPrivateStorageTotalBytes(): Promise<number> {
  async function walk(dir: string): Promise<number> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let total = 0;
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          total += await walk(full);
        } else if (entry.isFile()) {
          const stat = await fs.stat(full);
          total += stat.size;
        }
      }
      return total;
    } catch {
      return 0;
    }
  }
  return walk(PRIVATE_STORAGE_ROOT);
}

export function createSignedStorageToken(params: {
  userId: number;
  storagePath: string;
  fileName: string;
  mimeType: string;
  ttlSeconds?: number;
}): string {
  const exp = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 300);
  const payload = Buffer.from(
    JSON.stringify({
      userId: params.userId,
      storagePath: params.storagePath,
      fileName: params.fileName,
      mimeType: params.mimeType,
      exp,
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySignedStorageToken(token: string): {
  userId: number;
  storagePath: string;
  fileName: string;
  mimeType: string;
} | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId: number;
      storagePath: string;
      fileName: string;
      mimeType: string;
      exp: number;
    };
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      userId: parsed.userId,
      storagePath: parsed.storagePath,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
    };
  } catch {
    return null;
  }
}
