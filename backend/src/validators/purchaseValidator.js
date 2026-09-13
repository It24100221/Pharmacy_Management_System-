const ApiError = require('../middleware/errorHandler');

class PurchaseValidator {
  // Validate purchase date
  static isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  // Validate purchase creation data
  static validateCreate(data) {
    const errors = [];

    // Supplier ID is required
    if (!data.supplier_id || data.supplier_id === '') {
      errors.push('Supplier is required');
    } else {
      const supplierId = parseInt(data.supplier_id);
      if (isNaN(supplierId) || supplierId <= 0) {
        errors.push('Invalid supplier ID');
      }
    }

    // Purchase date is required
    if (!data.purchase_date || data.purchase_date.trim() === '') {
      errors.push('Purchase date is required');
    } else if (!this.isValidDate(data.purchase_date)) {
      errors.push('Invalid purchase date format');
    }

    // Items are required
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one purchase item is required');
    } else {
      // Validate each item
      data.items.forEach((item, index) => {
        const itemErrors = [];

        // Medicine ID
        if (!item.medicine_id || item.medicine_id === '') {
          itemErrors.push(`Item ${index + 1}: Medicine is required`);
        } else {
          const medicineId = parseInt(item.medicine_id);
          if (isNaN(medicineId) || medicineId <= 0) {
            itemErrors.push(`Item ${index + 1}: Invalid medicine ID`);
          }
        }

        // Quantity
        if (item.quantity === undefined || item.quantity === null || item.quantity === '') {
          itemErrors.push(`Item ${index + 1}: Quantity is required`);
        } else {
          const quantity = parseInt(item.quantity);
          if (isNaN(quantity)) {
            itemErrors.push(`Item ${index + 1}: Quantity must be a valid number`);
          } else if (quantity <= 0) {
            itemErrors.push(`Item ${index + 1}: Quantity must be greater than 0`);
          }
        }

        // Unit cost
        if (item.unit_cost === undefined || item.unit_cost === null || item.unit_cost === '') {
          itemErrors.push(`Item ${index + 1}: Unit cost is required`);
        } else {
          const unitCost = parseFloat(item.unit_cost);
          if (isNaN(unitCost)) {
            itemErrors.push(`Item ${index + 1}: Unit cost must be a valid number`);
          } else if (unitCost < 0) {
            itemErrors.push(`Item ${index + 1}: Unit cost cannot be negative`);
          }
        }

        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
        }
      });

      // Validate total_cost if provided (should match quantity * unit_cost)
      data.items.forEach((item, index) => {
        if (item.total_cost !== undefined && item.total_cost !== null && item.total_cost !== '') {
          const expectedTotal = parseInt(item.quantity) * parseFloat(item.unit_cost);
          const providedTotal = parseFloat(item.total_cost);
          if (Math.abs(expectedTotal - providedTotal) > 0.01) {
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

    // Build validated data
    const items = data.items.map(item => ({
      medicine_id: parseInt(item.medicine_id),
      quantity: parseInt(item.quantity),
      unit_cost: parseFloat(item.unit_cost),
      total_cost: parseFloat(item.total_cost) || (parseInt(item.quantity) * parseFloat(item.unit_cost))
    }));

    return {
      supplier_id: parseInt(data.supplier_id),
      purchase_date: data.purchase_date,
      notes: data.notes ? data.notes.trim() : null,
      items: items
    };
  }
}

module.exports = PurchaseValidator;
