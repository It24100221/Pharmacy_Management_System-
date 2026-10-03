const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const ApiError = require('../middleware/errorHandler');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const PRESCRIPTION_DIRECTORY = path.join(UPLOADS_ROOT, 'prescriptions');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const allowedTypes = Object.freeze({
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], storedExtension: '.jpg' },
  'image/png': { extensions: ['.png'], storedExtension: '.png' },
});

const hasJpegSignature = buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const hasPngSignature = buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

function validateAndDescribe(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !Number.isInteger(file.size)) {
    throw new ApiError('Malformed prescription file', 400);
  }
  if (file.size === 0 || file.buffer.length === 0) {
    throw new ApiError('Prescription file must not be empty', 400);
  }
  if (file.size !== file.buffer.length) {
    throw new ApiError('Prescription file size is invalid', 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ApiError('Prescription file must not exceed 10 MB', 413);
  }

  const type = allowedTypes[file.declaredMimeType];
  if (!type) throw new ApiError('Only JPEG and PNG prescription files are accepted; PDF is not supported', 415);

  const normalizedOriginalName = String(file.originalName || '').replace(/\\/g, '/');
  const originalBaseName = path.posix.basename(normalizedOriginalName).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!originalBaseName || originalBaseName.length > 255) throw new ApiError('Prescription filename is invalid', 400);

  const originalExtension = path.extname(originalBaseName).toLowerCase();
  if (!type.extensions.includes(originalExtension)) throw new ApiError('Prescription filename extension does not match its MIME type', 415);

  const signatureValid = file.declaredMimeType === 'image/jpeg'
    ? hasJpegSignature(file.buffer)
    : hasPngSignature(file.buffer);
  if (!signatureValid) throw new ApiError('Prescription file content does not match its MIME type', 415);

  const storedFilename = `${crypto.randomUUID()}${type.storedExtension}`;
  return {
    originalFilename: originalBaseName,
    storedFilename,
    storagePath: path.posix.join('prescriptions', storedFilename),
    mimeType: file.declaredMimeType,
    fileSize: file.size,
  };
}

function resolveStoragePath(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') throw new ApiError('Prescription file is unavailable', 404);
  const normalized = storagePath.replace(/\\/g, '/');
  if (!/^prescriptions\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i.test(normalized)) {
    throw new ApiError('Prescription file reference is invalid', 404);
  }
  const absolutePath = path.resolve(UPLOADS_ROOT, ...normalized.split('/'));
  const relativePath = path.relative(UPLOADS_ROOT, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new ApiError('Prescription file reference is invalid', 404);
  }
  return absolutePath;
}

async function saveFile(buffer, metadata) {
  await fs.mkdir(PRESCRIPTION_DIRECTORY, { recursive: true });
  const absolutePath = resolveStoragePath(metadata.storagePath);
  await fs.writeFile(absolutePath, buffer, { flag: 'wx' });
  return absolutePath;
}

async function readFile(storagePath) {
  try {
    return await fs.readFile(resolveStoragePath(storagePath));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.code === 'ENOENT') throw new ApiError('Prescription file not found', 404);
    throw error;
  }
}

async function deleteFile(storagePath) {
  if (!storagePath) return;
  try {
    await fs.unlink(resolveStoragePath(storagePath));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = {
  MAX_FILE_BYTES,
  PRESCRIPTION_DIRECTORY,
  deleteFile,
  readFile,
  resolveStoragePath,
  saveFile,
  validateAndDescribe,
};
