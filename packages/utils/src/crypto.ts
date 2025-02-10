import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto';
import { deflateSync, inflateSync } from 'zlib';
import { Settings } from './settings';
import JSONCrush from 'jsoncrush';

const pad = (data: Buffer, blockSize: number): Buffer => {
  const padding = blockSize - (data.length % blockSize);
  return Buffer.concat([data, Buffer.alloc(padding, padding)]);
};

const unpad = (data: Buffer): Buffer => {
  const padding = data[data.length - 1];
  return data.subarray(0, data.length - padding);
};

export const compressAndEncrypt = (data: string): string => {
  // compress it with jsoncrush
  const crushedData = JSONCrush.crush(data);
  // First compress the data with Deflate compression
  const compressedData = deflateSync(Buffer.from(crushedData, 'utf-8'), {
    level: 9,
  });
  const secretKey = Settings.SECRET_KEY;
  if (!secretKey) {
    console.error('|ERR| crypto > compressAndEncrypt > No secret key provided');
    throw new Error('No secret key provided');
  }

  // Then encrypt the compressed data
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', secretKey, iv);

  // Ensure proper padding
  const paddedData = pad(compressedData, 16);
  const encryptedData = Buffer.concat([
    cipher.update(paddedData),
    cipher.final(),
  ]);
  const finalString = `E2-${encodeURIComponent(iv.toString('base64'))}-${encodeURIComponent(encryptedData.toString('base64'))}`;
  return finalString;
};

export const decryptAndDecompress = (
  encryptedData: Buffer,
  iv: Buffer,
  eVersion: number
): string => {
  const secretKey = Settings.SECRET_KEY;
  if (!secretKey) {
    console.error(
      '|ERR| crypto > decryptAndDecompress > No secret key provided'
    );
    throw new Error('No secret key provided');
  }
  const decipher = createDecipheriv('aes-256-cbc', secretKey, iv);

  // Decrypt the data
  const decryptedPaddedData = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  // Remove padding
  const decryptedData = unpad(decryptedPaddedData);

  // Decompress the data with Deflate decompression
  const decompressedData = inflateSync(decryptedData);
  if (eVersion === 2) {
    return JSONCrush.uncrush(decompressedData.toString('utf-8'));
  }
  return decompressedData.toString('utf-8');
};

export function parseAndDecryptString(data: string): string | null {
  try {
    if (data.startsWith('E-') || data.startsWith('E2-')) {
      const eVersion = data.startsWith('E2-') ? 2 : 1;
      const encoding = eVersion === 1 ? 'hex' : 'base64';
      const [ivHex, encryptedHex] = data
        .replace('E-', '')
        .replace('E2-', '')
        .split('-')
        .map(decodeURIComponent);
      const iv = Buffer.from(ivHex, encoding);
      const encrypted = Buffer.from(encryptedHex, encoding);
      return decryptAndDecompress(encrypted, iv, eVersion);
    }
    return data;
  } catch (error: any) {
    console.error(
      `|ERR| crypto > parseAndDecryptString > Failed to decrypt data: ${error.message}`
    );
    return null;
  }
}

export function getTextHash(text: string): string {
  const hash = createHash('sha256');
  hash.update(text);
  return hash.digest('hex');
}
