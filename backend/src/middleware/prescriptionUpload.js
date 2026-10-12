const { Readable, Transform } = require('stream');
const ApiError = require('./errorHandler');
const { MAX_FILE_BYTES } = require('../services/prescriptionFileStorage');

const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + (128 * 1024);

async function parsePrescriptionUpload(req, res, next) {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    return next(new ApiError('Prescription uploads must use multipart/form-data', 415));
  }

  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return next(new ApiError('Prescription file must not exceed 10 MB', 413));
  }

  let receivedBytes = 0;
  let exceededLimit = false;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_MULTIPART_BYTES) {
        exceededLimit = true;
        callback(new Error('Upload request too large'));
        return;
      }
      callback(null, chunk);
    },
  });

  req.pipe(limiter);

  try {
    const request = new Request('http://localhost/prescription-upload', {
      method: 'POST',
      headers: req.headers,
      body: Readable.toWeb(limiter),
      duplex: 'half',
    });
    const form = await request.formData();
    const files = form.getAll('file');
    if (files.length !== 1 || typeof files[0]?.arrayBuffer !== 'function') {
      throw new ApiError('Exactly one prescription file is required', 400);
    }

    const file = files[0];
    if (file.size === 0) throw new ApiError('Prescription file must not be empty', 400);
    if (file.size > MAX_FILE_BYTES) throw new ApiError('Prescription file must not exceed 10 MB', 413);

    const doctorName = form.get('doctorName');
    const notes = form.get('notes');
    const orderId = form.get('orderId');
    req.prescriptionUpload = {
      file: {
        buffer: Buffer.from(await file.arrayBuffer()),
        originalName: String(file.name || ''),
        declaredMimeType: String(file.type || '').toLowerCase(),
        size: file.size,
      },
      doctorName: typeof doctorName === 'string' ? doctorName.trim() : '',
      notes: typeof notes === 'string' ? notes.trim() : '',
      orderId: typeof orderId === 'string' && orderId.trim() ? Number.parseInt(orderId, 10) : null,
    };
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (exceededLimit) return next(new ApiError('Prescription file must not exceed 10 MB', 413));
    return next(new ApiError('Malformed multipart prescription upload', 400));
  }
}

module.exports = { MAX_FILE_BYTES, MAX_MULTIPART_BYTES, parsePrescriptionUpload };
