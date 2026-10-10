const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const prescriptionRepository = require('../repositories/prescriptionRepository');
const prescriptionFileStorage = require('../services/prescriptionFileStorage');
const { parsePositiveInteger } = require('../utils/requestValidation');
const notificationRepository = require('../repositories/notificationRepository');

const toPublicUpload = upload => ({
  prescription_id: upload.prescription_id,
  order_id: upload.order_id,
  customer_id: upload.customer_id,
  original_filename: upload.original_filename,
  mime_type: upload.mime_type,
  file_size: upload.file_size,
  doctor_name: upload.doctor_name,
  notes: upload.notes,
  status: upload.status,
  created_date: upload.uploaded_date || upload.created_date,
  file_url: upload.storage_path ? `/api/prescription-uploads/${upload.prescription_id}/file` : null,
});

const validateMetadata = ({ doctorName, notes }) => {
  if (doctorName.length > 200) throw new ApiError('Doctor name must not exceed 200 characters', 400);
  if (notes.length > 5000) throw new ApiError('Notes must not exceed 5000 characters', 400);
};

async function persistPrescriptionUpload({ customerId, file, doctorName, notes, orderId }, dependencies = {}) {
  const repository = dependencies.repository || prescriptionRepository;
  const storage = dependencies.storage || prescriptionFileStorage;
  const metadata = storage.validateAndDescribe(file);

  await storage.saveFile(file.buffer, metadata);
  try {
    const prescriptionId = await repository.createUpload({
      customerId,
      ...metadata,
      doctorName: doctorName || null,
      notes: notes || null,
      orderId: orderId || null,
    });
    return { prescriptionId, metadata };
  } catch (error) {
    try {
      await storage.deleteFile(metadata.storagePath);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
}

const uploadPrescription = asyncHandler(async (req, res) => {
  if (!req.user?.customerId) throw new ApiError('Customer profile is required', 400);
  const { file, doctorName, notes, orderId } = req.prescriptionUpload;
  if (orderId !== null && (!Number.isInteger(orderId) || orderId <= 0)) throw new ApiError('Invalid order ID', 400);
  validateMetadata({ doctorName, notes });
  const { prescriptionId, metadata } = await persistPrescriptionUpload({
    customerId: req.user.customerId,
    file,
    doctorName,
    notes,
    orderId,
  });

  await notificationRepository.notifyRole({
    role: 'PHARMACIST',
    type: 'PRESCRIPTION_RECEIVED',
    title: 'Prescription received',
    message: `Prescription ${prescriptionId} is waiting for pharmacist review.`,
    entityType: 'prescription_upload',
    entityId: prescriptionId,
    deduplicationKey: `prescription-received:${prescriptionId}`,
  });

  res.status(201).json({
    success: true,
    message: 'Prescription uploaded for review',
    data: {
      id: prescriptionId,
      order_id: orderId,
      status: orderId ? 'PENDING_REVIEW' : 'PENDING',
      original_filename: metadata.originalFilename,
      mime_type: metadata.mimeType,
      file_size: metadata.fileSize,
      file_url: `/api/prescription-uploads/${prescriptionId}/file`,
    },
  });
});

const getOwnUploads = asyncHandler(async (req, res) => {
  const uploads = await prescriptionRepository.findUploadsByCustomer(req.user.customerId);
  res.json({ success: true, data: { prescriptions: uploads.map(toPublicUpload) } });
});

const listForReview = asyncHandler(async (req, res) => {
  const status = req.query.status === 'all' ? null : 'PENDING';
  const uploads = await prescriptionRepository.findUploadsForReview(status);
  res.json({ success: true, data: { uploads } });
});

const reviewStandalone = asyncHandler(async (req, res) => {
  const id = parsePositiveInteger(req.params.id, 'prescription upload ID');
  const decision = String(req.body?.decision || '').toUpperCase();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new ApiError('Decision must be APPROVED or REJECTED', 400);
  if (decision === 'REJECTED' && !reason) throw new ApiError('A rejection reason is required', 400);
  if (reason.length > 1000) throw new ApiError('Rejection reason is too long', 400);
  const upload = await prescriptionRepository.reviewUpload(id, req.user.userId, decision, reason);
  const customerUserId = await notificationRepository.findUserIdForCustomer(upload.customer_id);
  if (customerUserId) await notificationRepository.create({ recipientUserId: customerUserId,
    type: decision === 'APPROVED' ? 'PRESCRIPTION_APPROVED' : 'PRESCRIPTION_REJECTED',
    title: decision === 'APPROVED' ? 'Prescription reviewed' : 'Prescription rejected',
    message: decision === 'APPROVED' ? `Prescription upload ${id} was reviewed. A pharmacist must confirm the medicines before billing.` : `Prescription upload ${id} was rejected.`,
    entityType: 'prescription_upload', entityId: id, deduplicationKey: `upload-review:${id}:${decision}` });
  res.json({ success: true, data: toPublicUpload(upload) });
});

const getCustomerUploads = asyncHandler(async (req, res) => {
  const customerId = parsePositiveInteger(req.params.id, 'customer ID');
  if (req.user.role === 'CUSTOMER' && Number(req.user.customerId) !== customerId) {
    return res.status(403).json({ success: false, message: 'You can only view your own prescriptions' });
  }
  const uploads = await prescriptionRepository.findUploadsByCustomer(customerId);
  res.json({ success: true, data: { prescriptions: uploads.map(toPublicUpload) } });
});

const getFile = asyncHandler(async (req, res) => {
  const id = parsePositiveInteger(req.params.id, 'prescription upload ID');
  const upload = await prescriptionRepository.findUploadById(id);
  if (!upload) throw new ApiError('Prescription upload not found', 404);
  if (req.user.role === 'CUSTOMER' && Number(upload.customer_id) !== Number(req.user.customerId)) {
    return res.status(403).json({ success: false, message: 'You can only access your own prescription files' });
  }
  if (!upload.storage_path || !upload.mime_type) throw new ApiError('Prescription file is unavailable', 404);

  const file = await prescriptionFileStorage.readFile(upload.storage_path);
  const safeDownloadName = encodeURIComponent(String(upload.original_filename || 'prescription'));
  const fallbackName = upload.mime_type === 'application/pdf'
    ? 'prescription.pdf'
    : upload.mime_type === 'image/png' ? 'prescription.png' : 'prescription.jpg';
  res.set({
    'Content-Type': upload.mime_type,
    'Content-Length': String(file.length),
    'Content-Disposition': `inline; filename="${fallbackName}"; filename*=UTF-8''${safeDownloadName}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.send(file);
});

module.exports = {
  getCustomerUploads,
  getFile,
  getOwnUploads,
  persistPrescriptionUpload,
  uploadPrescription,
  listForReview,
  reviewStandalone,
};
