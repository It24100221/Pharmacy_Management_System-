const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class MedicineRepository {
  async findBatches(medicineId, { includeExpired = true } = {}) {
    const expiryFilter = includeExpired ? '' : ' AND expiry_date >= CAST(GETDATE() AS date)';
    const [rows] = await pool.execute(`
      SELECT batch_id, medicine_id, batch_number, expiry_date, quantity_available,
        unit_cost, received_at, is_active,
        CASE WHEN expiry_date < CAST(GETDATE() AS date) THEN 1 ELSE 0 END AS is_expired
      FROM medicine_batches
      WHERE medicine_id = ?${expiryFilter}
      ORDER BY expiry_date ASC, batch_id ASC
    `, [medicineId]);
    return rows;
  }

  async findStockMovements(medicineId, limit = 100) {
    const [rows] = await pool.execute(`
      SELECT TOP (?) movement_id, medicine_id, batch_id, movement_type, quantity_delta,
        balance_after, reference_type, reference_id, idempotency_key, notes, created_by, created_at
      FROM stock_movements WHERE medicine_id = ?
      ORDER BY created_at DESC, movement_id DESC
    `, [limit, medicineId]);
    return rows;
  }

  async createBatch(medicineId, data, actorUserId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [medicineRows] = await connection.execute('SELECT id FROM medicines WITH (UPDLOCK, HOLDLOCK) WHERE id = ?', [medicineId]);
      if (!medicineRows[0]) throw new ApiError('Medicine not found', 404);
      const [existing] = await connection.execute('SELECT batch_id FROM medicine_batches WITH (UPDLOCK, HOLDLOCK) WHERE medicine_id = ? AND batch_number = ?', [medicineId, data.batch_number]);
      if (existing[0]) throw new ApiError('Batch number already exists for this medicine', 409);
      const [created] = await connection.execute(`
        INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity_available, unit_cost)
        VALUES (?, ?, ?, 0, ?);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS batch_id;
      `, [medicineId, data.batch_number, data.expiry_date, data.unit_cost ?? null]);
      await connection.commit();
      return { batch_id: created.batch_id, medicine_id: medicineId, batch_number: data.batch_number, expiry_date: data.expiry_date, quantity_available: 0, unit_cost: data.unit_cost ?? null, created_by: actorUserId };
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
      throw error;
    } finally {
      connection.release();
    }
  }

  async adjustStock(medicineId, { batch_id: batchId, quantity_delta: quantityDelta, reason, idempotency_key: idempotencyKey }, actorUserId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingMovement] = await connection.execute('SELECT TOP (1) movement_id, medicine_id, batch_id, quantity_delta, balance_after, notes, created_at FROM stock_movements WHERE idempotency_key = ?', [idempotencyKey]);
      if (existingMovement[0]) {
        await connection.rollback();
        return { duplicate: true, movement: existingMovement[0] };
      }

      const [medicineRows] = await connection.execute('SELECT id, quantity FROM medicines WITH (UPDLOCK, HOLDLOCK) WHERE id = ?', [medicineId]);
      if (!medicineRows[0]) throw new ApiError('Medicine not found', 404);
      let batch = null;
      if (batchId !== null && batchId !== undefined) {
        const [batchRows] = await connection.execute('SELECT batch_id, medicine_id, quantity_available FROM medicine_batches WITH (UPDLOCK, HOLDLOCK) WHERE batch_id = ?', [batchId]);
        batch = batchRows[0];
        if (!batch || Number(batch.medicine_id) !== Number(medicineId)) throw new ApiError('Batch not found for this medicine', 404);
        const [updatedBatch] = await connection.execute(`
          UPDATE medicine_batches
          SET quantity_available = quantity_available + ?
          WHERE batch_id = ? AND quantity_available + ? >= 0;
          SELECT @@ROWCOUNT AS affectedRows;
        `, [quantityDelta, batchId, quantityDelta]);
        if (Number(updatedBatch[0]?.affectedRows) !== 1) throw new ApiError('Stock adjustment would make batch quantity negative', 409);
      }

      const [updatedMedicine] = await connection.execute(`
        UPDATE medicines SET quantity = quantity + ?
        WHERE id = ? AND quantity + ? >= 0;
        SELECT @@ROWCOUNT AS affectedRows;
      `, [quantityDelta, medicineId, quantityDelta]);
      if (Number(updatedMedicine[0]?.affectedRows) !== 1) throw new ApiError('Stock adjustment would make aggregate quantity negative', 409);
      const [balanceRows] = await connection.execute('SELECT quantity AS balance_after FROM medicines WHERE id = ?', [medicineId]);
      const balanceAfter = Number(balanceRows[0]?.balance_after ?? 0);
      await connection.execute(`
        INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity_delta, balance_after, reference_type, idempotency_key, notes, created_by)
        VALUES (?, ?, 'ADJUSTMENT', ?, ?, 'ADJUSTMENT', ?, ?, ?)
      `, [medicineId, batchId ?? null, quantityDelta, balanceAfter, idempotencyKey, reason, actorUserId || null]);
      await connection.commit();
      return { duplicate: false, movement: { medicine_id: medicineId, batch_id: batchId ?? null, quantity_delta: quantityDelta, balance_after: balanceAfter, notes: reason, idempotency_key: idempotencyKey } };
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
      throw error;
    } finally {
      connection.release();
    }
  }
  // Get all medicines with optional filters
  async findAll(filters = {}) {
    let query = `
      SELECT
        m.id,
        pr.product_code,
        m.name,
        m.description,
        m.generic_name,
        m.manufacturer,
        m.category,
        m.batch_number,
        m.quantity,
        m.unit_price,
        m.expiry_date,
        m.min_stock_level,
        m.created_at,
        m.updated_at,
        CASE
          WHEN m.quantity = 0 THEN 'out_of_stock'
          WHEN m.quantity <= m.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END AS stock_status,
        CASE
          WHEN m.expiry_date < CURDATE() THEN 'expired'
          WHEN m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'near_expiry'
          ELSE 'valid'
        END AS expiry_status
      FROM medicines m
      LEFT JOIN products pr ON pr.medicine_id = m.id
      WHERE 1=1
    `;

    const params = [];

    // Search filter
    if (filters.search) {
      query += ` AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.batch_number LIKE ? OR pr.product_code LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Category filter
    if (filters.category) {
      query += ` AND m.category = ?`;
      params.push(filters.category);
    }

    // Stock status filter
    if (filters.stock_status) {
      if (filters.stock_status === 'low_stock') {
        query += ` AND m.quantity > 0 AND m.quantity <= m.min_stock_level`;
      } else if (filters.stock_status === 'out_of_stock') {
        query += ` AND m.quantity = 0`;
      } else if (filters.stock_status === 'in_stock') {
        query += ` AND m.quantity > m.min_stock_level`;
      }
    }

    // Expiry status filter
    if (filters.expiry_status) {
      if (filters.expiry_status === 'expired') {
        query += ` AND m.expiry_date < CURDATE()`;
      } else if (filters.expiry_status === 'near_expiry') {
        query += ` AND m.expiry_date >= CURDATE() AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`;
      }
    }

    query += ` ORDER BY m.name ASC`;

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;

    if (filters.pagination !== false) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get medicine by ID
  async findById(id) {
    const query = `
      SELECT
        m.id,
        pr.product_code,
        m.name,
        m.description,
        m.generic_name,
        m.manufacturer,
        m.category,
        m.batch_number,
        m.quantity,
        m.unit_price,
        m.expiry_date,
        m.min_stock_level,
        m.created_at,
        m.updated_at,
        CASE
          WHEN m.quantity = 0 THEN 'out_of_stock'
          WHEN m.quantity <= m.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END AS stock_status,
        CASE
          WHEN m.expiry_date < CURDATE() THEN 'expired'
          WHEN m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'near_expiry'
          ELSE 'valid'
        END AS expiry_status
      FROM medicines m
      LEFT JOIN products pr ON pr.medicine_id = m.id
      WHERE m.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  // Create new medicine
  async create(medicineData, actorUserId) {
    const connection = await pool.getConnection();
    const query = `
      DECLARE @created TABLE (insertId INT);
      INSERT INTO medicines (
        name, description, generic_name, manufacturer, category,
        batch_number, quantity, unit_price, expiry_date, min_stock_level
      ) OUTPUT INSERTED.id INTO @created(insertId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      SELECT insertId FROM @created;
    `;

    const values = [
      medicineData.name,
      medicineData.description || null,
      medicineData.generic_name || null,
      medicineData.manufacturer || null,
      medicineData.category || null,
      medicineData.batch_number || null,
      medicineData.quantity ?? 0,
      medicineData.unit_price ?? 0,
      medicineData.expiry_date,
      medicineData.min_stock_level ?? 10
    ];

    try {
      await connection.beginTransaction();
      const [duplicates] = await connection.execute(`
        SELECT TOP (1) id FROM medicines WITH (UPDLOCK, HOLDLOCK)
        WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(?)))
          AND LOWER(LTRIM(RTRIM(COALESCE(generic_name, '')))) = LOWER(LTRIM(RTRIM(COALESCE(?, ''))))
          AND LOWER(LTRIM(RTRIM(COALESCE(manufacturer, '')))) = LOWER(LTRIM(RTRIM(COALESCE(?, ''))))
      `, [medicineData.name, medicineData.generic_name || null, medicineData.manufacturer || null]);
      if (duplicates[0]) throw new ApiError('A medicine with the same name, generic name, and manufacturer already exists', 409);
      const [rows] = await connection.execute(query, values);
      const medicineId = rows[0].insertId;

      if (medicineData.quantity > 0) {
        const [batchRows] = await connection.execute(`
          INSERT INTO medicine_batches (
            medicine_id, batch_number, expiry_date, quantity_available, unit_cost
          ) VALUES (?, ?, ?, ?, ?);
          SELECT CAST(SCOPE_IDENTITY() AS INT) AS batch_id;
        `, [
          medicineId,
          medicineData.batch_number,
          medicineData.expiry_date,
          medicineData.quantity,
          null
        ]);
        const batchId = batchRows.batch_id;

        await connection.execute(`
          INSERT INTO stock_movements (
            medicine_id, batch_id, movement_type, quantity_delta, balance_after,
            reference_type, reference_id, idempotency_key, notes, created_by
          ) VALUES (?, ?, 'OPENING', ?, ?, 'MEDICINE', ?, ?, ?, ?)
        `, [
          medicineId,
          batchId,
          medicineData.quantity,
          medicineData.quantity,
          medicineId,
          `medicine-opening:${medicineId}`,
          'Opening stock recorded at medicine creation',
          actorUserId || null
        ]);
      }

      await connection.commit();
      return medicineId;
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update medicine
  async update(id, medicineData) {
    const allowedFields = [
      'name', 'description', 'generic_name', 'manufacturer', 'category',
      'batch_number', 'unit_price', 'expiry_date', 'min_stock_level'
    ];
    const fields = allowedFields.filter(field => Object.hasOwn(medicineData, field));
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.execute(
        'SELECT id, name, generic_name, manufacturer FROM medicines WITH (UPDLOCK, HOLDLOCK) WHERE id = ?',
        [id]
      );
      const existing = existingRows[0];
      if (!existing) throw new ApiError('Medicine not found', 404);

      const identity = {
        name: Object.hasOwn(medicineData, 'name') ? medicineData.name : existing.name,
        generic_name: Object.hasOwn(medicineData, 'generic_name') ? medicineData.generic_name : existing.generic_name,
        manufacturer: Object.hasOwn(medicineData, 'manufacturer') ? medicineData.manufacturer : existing.manufacturer
      };
      const normalize = value => String(value || '').trim().toLowerCase();
      const identityChanged = normalize(identity.name) !== normalize(existing.name)
        || normalize(identity.generic_name) !== normalize(existing.generic_name)
        || normalize(identity.manufacturer) !== normalize(existing.manufacturer);
      if (identityChanged) {
        const [duplicates] = await connection.execute(`
          SELECT TOP (1) id FROM medicines WITH (UPDLOCK, HOLDLOCK)
          WHERE id <> ?
            AND LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(?)))
            AND LOWER(LTRIM(RTRIM(COALESCE(generic_name, '')))) = LOWER(LTRIM(RTRIM(COALESCE(?, ''))))
            AND LOWER(LTRIM(RTRIM(COALESCE(manufacturer, '')))) = LOWER(LTRIM(RTRIM(COALESCE(?, ''))))
        `, [id, identity.name, identity.generic_name || null, identity.manufacturer || null]);
        if (duplicates[0]) throw new ApiError('A medicine with the same name, generic name, and manufacturer already exists', 409);
      }

      if (fields.length > 0) {
        const assignments = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => medicineData[field]);
        values.push(id);
        await connection.execute(`UPDATE medicines SET ${assignments} WHERE id = ?`, values);
      }
      await connection.commit();
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
      throw error;
    } finally {
      connection.release();
    }
    return this.findById(id);
  }

  // Get low stock medicines
  async findLowStock() {
    const query = `
      SELECT
        m.id,
        pr.product_code,
        m.name,
        m.quantity,
        m.min_stock_level,
        (m.min_stock_level - m.quantity) AS shortage
      FROM medicines m
      LEFT JOIN products pr ON pr.medicine_id = m.id
      WHERE m.quantity > 0 AND m.quantity <= m.min_stock_level
      ORDER BY m.quantity ASC
    `;

    const [rows] = await pool.execute(query);
    return rows;
  }

  // Get medicines by expiry status
  async findByExpiryStatus(status = 'all') {
    let query = `
      SELECT
        m.id,
        pr.product_code,
        m.name,
        m.expiry_date,
        m.quantity,
        CASE
          WHEN m.expiry_date < CURDATE() THEN 'expired'
          WHEN m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'near_expiry'
          ELSE 'valid'
        END AS expiry_status,
        DATEDIFF(m.expiry_date, CURDATE()) AS days_until_expiry
      FROM medicines m
      LEFT JOIN products pr ON pr.medicine_id = m.id
      WHERE 1=1
    `;

    if (status === 'expired') {
      query += ` AND m.expiry_date < CURDATE()`;
    } else if (status === 'near_expiry') {
      query += ` AND m.expiry_date >= CURDATE() AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`;
    }

    query += ` ORDER BY m.expiry_date ASC`;

    const [rows] = await pool.execute(query);
    return rows;
  }

  // Get total count
  async getCount(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM medicines m LEFT JOIN products pr ON pr.medicine_id = m.id WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.batch_number LIKE ? OR pr.product_code LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.category) {
      query += ` AND m.category = ?`;
      params.push(filters.category);
    }

    if (filters.stock_status === 'low_stock') {
      query += ` AND m.quantity > 0 AND m.quantity <= m.min_stock_level`;
    } else if (filters.stock_status === 'out_of_stock') {
      query += ` AND m.quantity = 0`;
    } else if (filters.stock_status === 'in_stock') {
      query += ` AND m.quantity > m.min_stock_level`;
    }

    if (filters.expiry_status === 'expired') {
      query += ` AND m.expiry_date < CURDATE()`;
    } else if (filters.expiry_status === 'near_expiry') {
      query += ` AND m.expiry_date >= CURDATE() AND m.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`;
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  }
}

module.exports = new MedicineRepository();
