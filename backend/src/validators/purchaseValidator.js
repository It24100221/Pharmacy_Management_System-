const ApiError = require('../middleware/errorHandler');

class PurchaseValidator {
  // Validate purchase date
  static isValidDate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  static getTodayDate() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  // Validate purchase creation data
  static validateCreate(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const errors = [];
    const integer = value => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };
    const decimal = value => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      if (typeof value === 'string' && !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    // Supplier ID is required
    if (!data.supplier_id || data.supplier_id === '') {
      errors.push('Supplier is required');
    } else {
      const supplierId = integer(data.supplier_id);
      if (supplierId === null || supplierId <= 0) {
        errors.push('Invalid supplier ID');
      }
    }

    // Purchase date is required
    if (typeof data.purchase_date !== 'string' || data.purchase_date.trim() === '') {
      errors.push('Purchase date is required');
    } else if (!this.isValidDate(data.purchase_date)) {
      errors.push('Invalid purchase date format');
    } else if (data.purchase_date < this.getTodayDate()) {
      errors.push('Purchase date cannot be in the past');
    }

    // Items are required
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one purchase item is required');
    } else {
      // Validate each item
      const medicineIds = new Set();
      data.items.forEach((item, index) => {
        const itemErrors = [];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`Item ${index + 1}: Invalid item`);
          return;
        }

        // Medicine ID
        if (!item.medicine_id || item.medicine_id === '') {
          itemErrors.push(`Item ${index + 1}: Medicine is required`);
        } else {
          const medicineId = integer(item.medicine_id);
          if (medicineId === null || medicineId <= 0) {
            itemErrors.push(`Item ${index + 1}: Invalid medicine ID`);
          } else if (medicineIds.has(medicineId)) {
            itemErrors.push(`Item ${index + 1}: Duplicate medicine lines are not allowed`);
          } else {
            medicineIds.add(medicineId);
          }
        }

        // Quantity
        if (item.quantity === undefined || item.quantity === null || item.quantity === '') {
          itemErrors.push(`Item ${index + 1}: Quantity is required`);
        } else {
          const quantity = integer(item.quantity);
          if (quantity === null) {
            itemErrors.push(`Item ${index + 1}: Quantity must be a valid number`);
          } else if (quantity <= 0) {
            itemErrors.push(`Item ${index + 1}: Quantity must be greater than 0`);
          } else if (quantity > 2147483647) {
            itemErrors.push(`Item ${index + 1}: Quantity is too large`);
          }
        }

        // Unit cost
        if (item.unit_cost === undefined || item.unit_cost === null || item.unit_cost === '') {
          itemErrors.push(`Item ${index + 1}: Unit cost is required`);
        } else {
          const unitCost = decimal(item.unit_cost);
          if (unitCost === null) {
            itemErrors.push(`Item ${index + 1}: Unit cost must be a valid number`);
          } else if (unitCost < 0) {
            itemErrors.push(`Item ${index + 1}: Unit cost cannot be negative`);
          } else if (unitCost > 99999999.99 || Math.abs(Math.round(unitCost * 100) - (unitCost * 100)) >= 1e-8) {
            itemErrors.push(`Item ${index + 1}: Unit cost must not exceed 99,999,999.99 and may have at most 2 decimal places`);
          }
        }

        const hasBatch = item.batch_number !== undefined && item.batch_number !== null && String(item.batch_number).trim() !== '';
        const hasExpiry = item.expiry_date !== undefined && item.expiry_date !== null && String(item.expiry_date).trim() !== '';
        if (hasBatch !== hasExpiry) itemErrors.push(`Item ${index + 1}: Batch number and expiry date must be provided together`);
        if (hasBatch && (typeof item.batch_number !== 'string' || item.batch_number.trim().length > 100)) itemErrors.push(`Item ${index + 1}: Invalid batch number`);
        if (hasExpiry && (typeof item.expiry_date !== 'string' || !this.isValidDate(item.expiry_date) || item.expiry_date < this.getTodayDate())) itemErrors.push(`Item ${index + 1}: Batch expiry date must be valid and not in the past`);

        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
        }
      });

      // Validate total_cost if provided (should match quantity * unit_cost)
      data.items.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        if (item.total_cost !== undefined && item.total_cost !== null && item.total_cost !== '') {
          const expectedTotal = integer(item.quantity) * decimal(item.unit_cost);
          const providedTotal = decimal(item.total_cost);
          if (providedTotal === null || !Number.isFinite(expectedTotal) || Math.abs(expectedTotal - providedTotal) > 0.01) {
            errors.push(
              `Item ${index + 1}: Total cost (${providedTotal}) does not match quantity * unit cost (${expectedTotal})`
            );
          }
        }
      });
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') errors.push('Notes must be text');
    if (typeof data.notes === 'string' && data.notes.trim().length > 5000) errors.push('Notes must not exceed 5000 characters');
    if (errors.length > 0) throw new ApiError(errors.join('; '), 400);

    // Build validated data
    const items = data.items.map(item => ({
      medicine_id: integer(item.medicine_id),
      quantity: integer(item.quantity),
      unit_cost: decimal(item.unit_cost),
      batch_number: item.batch_number ? item.batch_number.trim() : null,
      expiry_date: item.expiry_date || null,
      total_cost: item.total_cost === undefined || item.total_cost === null || item.total_cost === ''
        ? integer(item.quantity) * decimal(item.unit_cost)
        : decimal(item.total_cost)
    }));

    const idempotencyKey = data.idempotency_key === undefined || data.idempotency_key === null || data.idempotency_key === ''
      ? null : String(data.idempotency_key).trim();
    if (idempotencyKey && (idempotencyKey.length > 100 || !/^[A-Za-z0-9:_-]+$/.test(idempotencyKey))) throw new ApiError('Invalid idempotency key', 400);
    return {
      supplier_id: integer(data.supplier_id),
      purchase_date: data.purchase_date,
      notes: data.notes ? data.notes.trim() : null,
      items: items,
      idempotency_key: idempotencyKey
    };
  }
}

module.exports = PurchaseValidator;
