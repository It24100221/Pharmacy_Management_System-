const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const ApiError = require('../middleware/errorHandler');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const PRODUCT_DIRECTORY = path.join(UPLOADS_ROOT, 'products');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = Object.freeze({
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], storedExtension: '.jpg' },
  'image/png': { extensions: ['.png'], storedExtension: '.png' },
});

const hasJpegSignature = buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const hasPngSignature = buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

function validateAndDescribe(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !Number.isInteger(file.size)) throw new ApiError('Malformed product image', 400);
  if (!file.size || file.size !== file.buffer.length) throw new ApiError('Product image is empty or incomplete', 400);
  if (file.size > MAX_IMAGE_BYTES) throw new ApiError('Product image must not exceed 5 MB', 413);
  const type = allowedTypes[file.declaredMimeType];
  if (!type) throw new ApiError('Only JPEG and PNG product images are accepted', 415);

  const originalName = path.posix.basename(String(file.originalName || '').replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!originalName || originalName.length > 255) throw new ApiError('Product image filename is invalid', 400);
  if (!type.extensions.includes(path.extname(originalName).toLowerCase())) throw new ApiError('Product image extension does not match its MIME type', 415);
  const signatureValid = file.declaredMimeType === 'image/jpeg' ? hasJpegSignature(file.buffer) : hasPngSignature(file.buffer);
  if (!signatureValid) throw new ApiError('Product image content does not match its MIME type', 415);

  const storedFilename = `${crypto.randomUUID()}${type.storedExtension}`;
  return {
    originalFilename: originalName,
    storedFilename,
    storagePath: path.posix.join('products', storedFilename),
    mimeType: file.declaredMimeType,
    fileSize: file.size,
  };
}

function resolveStoragePath(storagePath) {
  const normalized = String(storagePath || '').replace(/\\/g, '/');
  if (!/^products\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i.test(normalized)) {
    throw new ApiError('Product image reference is invalid', 404);
  }
  const absolutePath = path.resolve(UPLOADS_ROOT, ...normalized.split('/'));
  const relativePath = path.relative(UPLOADS_ROOT, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) throw new ApiError('Product image reference is invalid', 404);
  return absolutePath;
}

async function saveFile(buffer, metadata) {
  await fs.mkdir(PRODUCT_DIRECTORY, { recursive: true });
  await fs.writeFile(resolveStoragePath(metadata.storagePath), buffer, { flag: 'wx' });
}

async function readFile(storagePath) {
  try { return await fs.readFile(resolveStoragePath(storagePath)); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.code === 'ENOENT') throw new ApiError('Product image not found', 404);
    throw error;
  }
}

async function deleteFile(storagePath) {
  if (!storagePath) return;
  try { await fs.unlink(resolveStoragePath(storagePath)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

module.exports = { MAX_IMAGE_BYTES, deleteFile, readFile, saveFile, validateAndDescribe };
