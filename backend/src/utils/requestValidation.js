const ApiError = require('../middleware/errorHandler');
const SQL_INT_MAX = 2147483647;

function parsePositiveInteger(value, field = 'ID') {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+$/.test(text.trim())) {
    throw new ApiError(`Invalid ${field}`, 400);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > SQL_INT_MAX) throw new ApiError(`Invalid ${field}`, 400);
  return parsed;
}

function parseBoundedInteger(value, {
  field,
  defaultValue,
  min = 1,
  max = 100,
} = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+$/.test(text.trim())) {
    throw new ApiError(`${field} must be an integer between ${min} and ${max}`, 400);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(`${field} must be an integer between ${min} and ${max}`, 400);
  }
  return parsed;
}

function parsePagination(query = {}, { defaultLimit = 50, maxLimit = 100 } = {}) {
  return {
    page: parseBoundedInteger(query.page, { field: 'Page', defaultValue: 1, max: 1000000 }),
    limit: parseBoundedInteger(query.limit, { field: 'Limit', defaultValue: defaultLimit, max: maxLimit }),
    pagination: query.pagination !== 'false',
  };
}

function parseRecentLimit(value, defaultValue = 5) {
  return parseBoundedInteger(value, { field: 'Limit', defaultValue, max: 100 });
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function todayInTimeZone(timeZone = 'Asia/Colombo') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateRange(startDate, endDate) {
  if (startDate !== undefined && startDate !== '' && !isIsoDate(startDate)) {
    throw new ApiError('Start date must use YYYY-MM-DD', 400);
  }
  if (endDate !== undefined && endDate !== '' && !isIsoDate(endDate)) {
    throw new ApiError('End date must use YYYY-MM-DD', 400);
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ApiError('Start date cannot be after end date', 400);
  }
  return {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };
}

function parseSearch(value, maxLength = 100) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ApiError('Search must be text', 400);
  const search = value.trim();
  if (search.length > maxLength) throw new ApiError(`Search must not exceed ${maxLength} characters`, 400);
  return search || undefined;
}

module.exports = {
  isIsoDate,
  parseBoundedInteger,
  parseDateRange,
  parsePagination,
  parsePositiveInteger,
  parseRecentLimit,
  parseSearch,
  todayInTimeZone,
};
