const { Readable, Transform } = require('stream');
const ApiError = require('./errorHandler');
const { MAX_IMAGE_BYTES } = require('../services/productImageStorage');

const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + (128 * 1024);

async function parseProductImage(req, res, next) {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) return next(new ApiError('Product images must use multipart/form-data', 415));
  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) return next(new ApiError('Product image must not exceed 5 MB', 413));

  let receivedBytes = 0;
  let exceededLimit = false;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_MULTIPART_BYTES) {
        exceededLimit = true;
        return callback(new Error('Upload request too large'));
      }
      callback(null, chunk);
    },
  });
  req.pipe(limiter);
  try {
    const request = new Request('http://localhost/product-image', {
      method: 'POST', headers: req.headers, body: Readable.toWeb(limiter), duplex: 'half',
    });
    const form = await request.formData();
    const files = form.getAll('file');
    if (files.length !== 1 || typeof files[0]?.arrayBuffer !== 'function') throw new ApiError('Exactly one product image is required', 400);
    const file = files[0];
    req.productImage = {
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: String(file.name || ''),
      declaredMimeType: String(file.type || '').toLowerCase(),
      size: file.size,
    };
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(exceededLimit ? 'Product image must not exceed 5 MB' : 'Malformed product image upload', exceededLimit ? 413 : 400));
  }
}

module.exports = { parseProductImage };
