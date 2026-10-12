const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const notificationRepository = require('../repositories/notificationRepository');
const { parsePositiveInteger } = require('../utils/requestValidation');

exports.list = asyncHandler(async (req, res) => {
  const unreadOnly = String(req.query.unread || '').toLowerCase() === 'true';
  const notifications = await notificationRepository.findForUser({
    userId: req.user.userId,
    role: req.user.role,
    unreadOnly,
    limit: Math.min(Math.max(Number(req.query.limit) || 50, 1), 100),
  });
  res.json({ success: true, data: { notifications, unread_count: await notificationRepository.countUnread(req.user.userId, req.user.role) } });
});

exports.markRead = asyncHandler(async (req, res) => {
  const id = parsePositiveInteger(req.params.id, 'notification ID');
  const updated = await notificationRepository.markRead(id, req.user.userId, req.user.role);
  if (!updated) throw new ApiError('Notification not found', 404);
  res.json({ success: true, message: 'Notification marked as read' });
});

