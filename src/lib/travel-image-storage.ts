import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\n\r]+)$/;

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export class TravelImagePersistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TravelImagePersistError';
  }
}

export function isDataImageUrl(value: string) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function parseDataUrl(value: string) {
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) {
    throw new TravelImagePersistError('Invalid image format.');
  }

  const mimeType = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) {
    throw new TravelImagePersistError('Only PNG, JPG, JPEG, WEBP, GIF are supported.');
  }

  const base64Payload = match[2].replace(/\s+/g, '');
  const bytes = Buffer.from(base64Payload, 'base64');
  if (!bytes.length) {
    throw new TravelImagePersistError('Image data is empty.');
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new TravelImagePersistError('Image must be <= 8MB.');
  }

  return { ext, bytes };
}

export async function persistTravelImage(input: string, folder: string) {
  if (!isDataImageUrl(input)) return input;

  const { ext, bytes } = parseDataUrl(input);
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '');
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'travel', safeFolder);
  await mkdir(uploadsDir, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  await writeFile(filePath, bytes);

  return `/uploads/travel/${safeFolder}/${fileName}`;
}

export async function persistTravelImages(inputs: string[], folder: string) {
  const results = await Promise.all(inputs.map((value) => persistTravelImage(value, folder)));
  return results.filter((value) => typeof value === 'string' && value.length > 0);
}
