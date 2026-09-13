// Date formatting utilities
export const formatDate = (date, options = {}) => {
  if (!date) return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return date

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }

  return d.toLocaleDateString('en-LK', { ...defaultOptions, ...options })
}

export const formatDateTime = (date, options = {}) => {
  if (!date) return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return date

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }

  return d.toLocaleString('en-LK', { ...defaultOptions, ...options })
}

export const formatDateForInput = (date) => {
  if (!date) return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return date

  return d.toISOString().split('T')[0]
}

export const formatTimeAgo = (date) => {
  if (!date) return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return date

  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDate(date)
}

export const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0]
}

export const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null

  const expiry = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)

  const diffTime = expiry - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

export const isExpired = (expiryDate) => {
  const days = getDaysUntilExpiry(expiryDate)
  return days !== null && days < 0
}

export const isNearExpiry = (expiryDate, daysThreshold = 30) => {
  const days = getDaysUntilExpiry(expiryDate)
  return days !== null && days >= 0 && days <= daysThreshold
}
