const normalizeRole = role => String(role ?? '').trim().toUpperCase();

module.exports = { normalizeRole };
