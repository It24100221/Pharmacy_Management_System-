const ApiError = require('../middleware/errorHandler');

const TYPES = ['Medicine', 'Baby Items', 'Lab Items', 'Medical Accessories'];
const CODE = /^[A-Z0-9-]{2,32}$/;
const URL_PATTERN = /^(https:\/\/.+|\/images\/[A-Za-z0-9/_-]+\.(?:png|jpe?g|webp|svg))$/i;

function cleanText(value) { return value == null || value === '' ? null : String(value).trim(); }
function number(value, label, integer = false) {
  const parsed = Number(value);
  if (value === null || value === '' || !Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    throw new ApiError(`${label} must be a non-negative ${integer ? 'integer' : 'number'}`, 400);
  }
  return parsed;
}
function flag(value, label) {
  if (value === true || value === false) return value;
  if (value === 1 || value === 0) return Boolean(value);
  throw new ApiError(`${label} must be a boolean`, 400);
}
function date(value, required) {
  if (value === null || value === '' || value === undefined) {
    if (required) throw new ApiError('Expiry date is required', 400);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new ApiError('Expiry date must be a valid date', 400);
  }
  return value;
}

class MedicineValidator {
  static validateCreate(data) {
    if (!data || typeof data.name !== 'string' || !data.name.trim()) throw new ApiError('Product name is required', 400);
    if (typeof data.product_code !== 'string' || !CODE.test(data.product_code)) {
      throw new ApiError('Product ID must be 2–32 uppercase letters, digits or hyphens', 400);
    }
    const type = data.product_type || 'Medicine';
    if (!TYPES.includes(type)) throw new ApiError('Invalid product type', 400);
    const image = cleanText(data.image_url);
    if (image && (image.length > 512 || !URL_PATTERN.test(image))) throw new ApiError('Image URL must be HTTPS or a local /images/ path under 512 characters', 400);
    return {
      product_code: data.product_code, product_type: type,
      name: data.name.trim(), description: cleanText(data.description),
      generic_name: cleanText(data.generic_name), manufacturer: cleanText(data.manufacturer),
      category: cleanText(data.category), batch_number: cleanText(data.batch_number),
      quantity: data.quantity === undefined ? 0 : number(data.quantity, 'Quantity', true),
      unit_price: data.unit_price === undefined ? 0 : number(data.unit_price, 'Unit price'),
      expiry_date: date(data.expiry_date, type === 'Medicine'),
      min_stock_level: data.min_stock_level === undefined ? 10 : number(data.min_stock_level, 'Minimum stock level', true),
      image_url: image,
      requires_prescription: data.requires_prescription === undefined ? type === 'Medicine' : flag(data.requires_prescription, 'Prescription requirement'),
      is_active: data.is_active === undefined ? true : flag(data.is_active, 'Active state')
    };
  }

  static validateUpdate(id, data, existing = {}) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new ApiError('Invalid medicine ID', 400);
    if (Object.hasOwn(data, 'product_code')) throw new ApiError('Product ID cannot be changed after creation', 400);
    const update = {};
    const type = data.product_type === undefined ? existing.product_type : data.product_type;
    if (data.product_type !== undefined) {
      if (!TYPES.includes(data.product_type)) throw new ApiError('Invalid product type', 400);
      update.product_type = data.product_type;
    }
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) throw new ApiError('Name cannot be set to null or empty', 400);
      update.name = data.name.trim();
    }
    for (const key of ['description', 'generic_name', 'manufacturer', 'category', 'batch_number']) {
      if (data[key] !== undefined) update[key] = cleanText(data[key]);
    }
    if (data.quantity !== undefined) update.quantity = number(data.quantity, 'Quantity', true);
    if (data.unit_price !== undefined) update.unit_price = number(data.unit_price, 'Unit price');
    if (data.min_stock_level !== undefined) update.min_stock_level = number(data.min_stock_level, 'Minimum stock level', true);
    if (data.expiry_date !== undefined) update.expiry_date = date(data.expiry_date, type === 'Medicine');
    if (type === 'Medicine' && data.product_type === 'Medicine' && !data.expiry_date && !existing.expiry_date) {
      throw new ApiError('Expiry date is required for medicine', 400);
    }
    if (data.image_url !== undefined) {
      const image = cleanText(data.image_url);
      if (image && (image.length > 512 || !URL_PATTERN.test(image))) throw new ApiError('Image URL must be HTTPS or a local /images/ path under 512 characters', 400);
      update.image_url = image;
    }
    if (data.requires_prescription !== undefined) update.requires_prescription = flag(data.requires_prescription, 'Prescription requirement');
    if (data.is_active !== undefined) update.is_active = flag(data.is_active, 'Active state');
    return update;
  }
}

module.exports = MedicineValidator;
