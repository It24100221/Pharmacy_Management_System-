const ApiError = require('../middleware/errorHandler');

function allocateFefo({ medicineName, requestedQuantity, aggregateQuantity, batches, today }) {
  const dateOnly = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const quantity = Number(requestedQuantity);
  const total = Number(aggregateQuantity);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new ApiError('Sale quantity is invalid', 400);
  if (!Number.isSafeInteger(total) || total < 0) throw new ApiError('Aggregate stock is invalid', 409);
  const batchTotal = batches.reduce((sum, batch) => sum + Number(batch.quantity_available), 0);
  const legacyUnallocated = total - batchTotal;
  if (!Number.isSafeInteger(legacyUnallocated) || legacyUnallocated < 0) {
    throw new ApiError(`Inventory reconciliation required for ${medicineName}`, 409);
  }
  const eligible = [...batches].filter(batch => Number(batch.is_active) === 1 &&
    dateOnly(batch.expiry_date) >= today && Number(batch.quantity_available) > 0)
    .sort((a, b) => dateOnly(a.expiry_date).localeCompare(dateOnly(b.expiry_date)) || Number(a.batch_id) - Number(b.batch_id));
  const allocation = [];
  let remaining = quantity;
  for (const batch of eligible) {
    if (!remaining) break;
    const used = Math.min(remaining, Number(batch.quantity_available));
    allocation.push({ batchId: Number(batch.batch_id), quantity: used });
    remaining -= used;
  }
  if (remaining > legacyUnallocated) throw new ApiError(`Insufficient eligible stock for ${medicineName}`, 409);
  if (remaining) allocation.push({ batchId: null, quantity: remaining });
  return { allocation, legacyUnallocated, batchTotal, eligibleBatchQuantity: eligible.reduce((sum, batch) => sum + Number(batch.quantity_available), 0) };
}

module.exports = { allocateFefo };
