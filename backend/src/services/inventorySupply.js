const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

const requestSelect = `SELECT rr.*, m.name AS medicine_name, m.medicine_number,
  p.product_code, p.product_id, p.image_path, p.image_external_url, p.image_alt_text,
  stock.available_quantity, stock.physical_quantity, stock.min_stock_level, stock.reorder_target,
  s.company_name AS supplier_name, response.supplier_response_id, response.response_status,
  response.available_quantity AS supplier_available_quantity, response.estimated_delivery_date,
  response.unit_purchase_price, response.supplier_message, response.approval_status,
  po.purchase_order_id, po.purchase_order_number, po.status AS purchase_order_status,
  (SELECT COUNT(*) FROM supplier_users su JOIN users u ON u.user_id=su.user_id WHERE su.supplier_id=rr.supplier_id AND u.role='SUPPLIER') AS supplier_account_count
  FROM reorder_requests rr JOIN medicines m ON m.id=rr.medicine_id
  JOIN v_inventory_supply_stock stock ON stock.medicine_id=m.id
  LEFT JOIN products p ON p.medicine_id=m.id LEFT JOIN suppliers s ON s.id=rr.supplier_id
  LEFT JOIN supplier_responses response ON response.reorder_request_id=rr.reorder_request_id
  LEFT JOIN purchase_orders po ON po.reorder_request_id=rr.reorder_request_id`;

const publicRequest = row => ({ ...row,
  image_url: row.image_external_url || (row.image_path ? `/api/products/${row.product_code}/image?v=${encodeURIComponent(row.image_path)}` : null),
});

async function transaction(action) {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await action(connection); await connection.commit(); return result; }
  catch (error) { try { await connection.rollback(); } catch {} throw error; }
  finally { connection.release(); }
}

function supplierScope(user) {
  if (user.role !== 'SUPPLIER') return null;
  if (!user.supplierId) throw new ApiError('Your supplier login must be linked to a supplier company by an administrator', 403);
  return Number(user.supplierId);
}

async function notify(connection, { supplierId, staff = false, type, title, message, entityType, entityId, key }) {
  const [recipients] = await connection.execute(staff
    ? "SELECT user_id FROM users WHERE role IN ('ADMIN','INVENTORY')"
    : "SELECT su.user_id FROM supplier_users su JOIN users u ON u.user_id=su.user_id WHERE su.supplier_id=? AND u.role='SUPPLIER'", staff ? [] : [supplierId]);
  for (const recipient of recipients) await connection.execute(`
    INSERT INTO notifications (recipient_user_id, notification_type, title, message, entity_type, entity_id, deduplication_key)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
      SELECT 1 FROM notifications WITH (UPDLOCK,HOLDLOCK) WHERE deduplication_key=?)`,
  [recipient.user_id, type, title, String(message).slice(0, 1000), entityType, entityId, `${key}:user:${recipient.user_id}`, `${key}:user:${recipient.user_id}`]);
}

async function notifyRequest(connection, id) {
  const [rows] = await connection.execute(`${requestSelect} WHERE rr.reorder_request_id=?`, [id]);
  const row = rows[0]; if (!row) return;
  await notify(connection, { supplierId: row.supplier_id, type: 'SUPPLY_REQUEST', title: 'Low Stock – Medicine Supply Request',
    message: `${row.medicine_name} (${row.product_code || row.medicine_number}); Current stock: ${row.available_quantity_snapshot ?? row.available_quantity}; Minimum stock: ${row.minimum_stock_snapshot ?? row.min_stock_level}; Requested quantity: ${row.requested_quantity}; Status: Pending Supplier Confirmation`,
    entityType: 'REORDER_REQUEST', entityId: id, key: `supply-request:${id}` });
}

async function listRequests({ status = null, supplierId = null } = {}) {
  const where = []; const params = [];
  if (status) { where.push('rr.status=?'); params.push(status); }
  if (supplierId) { where.push('rr.supplier_id=?'); params.push(supplierId); }
  const [rows] = await pool.execute(`${requestSelect} ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY rr.created_at DESC,rr.reorder_request_id DESC`, params);
  return rows.map(publicRequest);
}

async function getRequest(id, supplierId = null, connection = pool) {
  const [rows] = await connection.execute(`${requestSelect} WHERE rr.reorder_request_id=? ${supplierId ? 'AND rr.supplier_id=?' : ''}`, supplierId ? [id, supplierId] : [id]);
  return rows[0] ? publicRequest(rows[0]) : null;
}

async function lowStock(connection = pool) {
  const [rows] = await connection.execute(`SELECT stock.*, p.product_code, p.product_id,
    preferred.supplier_id AS preferred_supplier_id, preferred.company_name AS preferred_supplier_name,
    latest.reorder_request_id, latest.status AS request_status, response.response_status,
    response.approval_status, CASE WHEN stock.reorder_target IS NULL THEN NULL
      ELSE CASE WHEN stock.reorder_target-stock.available_quantity>0 THEN stock.reorder_target-stock.available_quantity ELSE 1 END END AS suggested_quantity
    FROM v_inventory_supply_stock stock LEFT JOIN products p ON p.medicine_id=stock.medicine_id
    OUTER APPLY (SELECT TOP 1 sm.supplier_id,s.company_name FROM supplier_medicines sm
      JOIN suppliers s ON s.id=sm.supplier_id WHERE sm.medicine_id=stock.medicine_id AND sm.is_active=1
      ORDER BY sm.is_preferred DESC,sm.created_at,sm.supplier_id) preferred
    OUTER APPLY (SELECT TOP 1 rr.reorder_request_id,rr.status FROM reorder_requests rr WHERE rr.medicine_id=stock.medicine_id
      AND (rr.supplier_id=preferred.supplier_id OR (rr.supplier_id IS NULL AND preferred.supplier_id IS NULL))
      ORDER BY CASE WHEN rr.status IN ('OPEN','ORDERED') THEN 0 ELSE 1 END,rr.reorder_request_id DESC) latest
    LEFT JOIN supplier_responses response ON response.reorder_request_id=latest.reorder_request_id
    WHERE stock.is_active=1 AND stock.available_quantity<=stock.min_stock_level ORDER BY stock.available_quantity,stock.name`);
  return rows;
}

async function createRequestInTransaction(connection, { medicineId, requestedQuantity, requestedBy, supplierId, notes = null, deliveryDate = null, priority = 'NORMAL' }) {
  const [medicines] = await connection.execute('SELECT id FROM medicines WITH (UPDLOCK,HOLDLOCK) WHERE id=? AND is_active=1', [medicineId]);
  if (!medicines[0]) throw new ApiError('Active medicine not found', 404);
  const [stocks] = await connection.execute('SELECT * FROM v_inventory_supply_stock WHERE medicine_id=?', [medicineId]);
  const stock = stocks[0];
  if (Number(stock.available_quantity) > Number(stock.min_stock_level)) throw new ApiError('Medicine is not currently at its reorder threshold', 409);
  if (!supplierId) {
    const [assigned] = await connection.execute('SELECT TOP 1 supplier_id FROM supplier_medicines WHERE medicine_id=? AND is_active=1 ORDER BY is_preferred DESC,created_at,supplier_id', [medicineId]);
    supplierId = assigned[0]?.supplier_id || null;
  }
  if (!supplierId) throw new ApiError('Assign a supplier to this medicine before requesting supply', 409);
  const [mapping] = await connection.execute('SELECT supplier_medicine_id FROM supplier_medicines WHERE medicine_id=? AND supplier_id=? AND is_active=1', [medicineId, supplierId]);
  if (!mapping[0]) throw new ApiError('Selected supplier is not assigned to this medicine', 409);
  const [existing] = await connection.execute("SELECT TOP 1 reorder_request_id FROM reorder_requests WITH (UPDLOCK,HOLDLOCK) WHERE medicine_id=? AND supplier_id=? AND status IN ('OPEN','ORDERED')", [medicineId, supplierId]);
  if (existing[0]) { await notifyRequest(connection, existing[0].reorder_request_id); return existing[0].reorder_request_id; }
  const quantity = requestedQuantity ?? (stock.reorder_target == null ? null : Number(stock.reorder_target) - Number(stock.available_quantity));
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new ApiError('Configure a reorder target or enter a positive requested quantity', 400);
  const [created] = await connection.execute(`INSERT INTO reorder_requests
    (medicine_id,supplier_id,requested_quantity,requested_by,notes,available_quantity_snapshot,minimum_stock_snapshot,reorder_target_snapshot,requested_delivery_date,priority)
    OUTPUT INSERTED.reorder_request_id AS insertId VALUES (?,?,?,?,?,?,?,?,?,?)`,
  [medicineId, supplierId, quantity, requestedBy, notes, stock.available_quantity, stock.min_stock_level, stock.reorder_target, deliveryDate, priority]);
  await notifyRequest(connection, created.insertId);
  await notify(connection, { staff: true, type: 'REORDER_REQUEST', title: 'Supply request created', message: `${stock.name}: ${quantity} units requested`, entityType: 'REORDER_REQUEST', entityId: created.insertId, key: `supply-created:${created.insertId}` });
  return created.insertId;
}

async function createRequest(data) { const id = await transaction(connection => createRequestInTransaction(connection, data)); return getRequest(id); }

async function checkLowStock(connection, medicineIds, actorUserId) {
  for (const medicineId of [...new Set(medicineIds)].sort((a,b)=>a-b)) {
    const [rows] = await connection.execute('SELECT * FROM v_inventory_supply_stock WHERE medicine_id=?', [medicineId]);
    const stock = rows[0];
    if (!stock || !stock.is_active || !stock.auto_reorder_enabled || stock.reorder_target == null || stock.available_quantity > stock.min_stock_level) continue;
    const [mappings] = await connection.execute('SELECT TOP 1 supplier_id FROM supplier_medicines WHERE medicine_id=? AND is_active=1 ORDER BY is_preferred DESC,created_at,supplier_id', [medicineId]);
    if (!mappings[0]) continue;
    await createRequestInTransaction(connection, { medicineId, requestedBy: actorUserId, supplierId: mappings[0].supplier_id });
  }
}

async function respond(id, user, data) {
  const supplierId = supplierScope(user);
  await transaction(async connection => {
    const [rows] = await connection.execute('SELECT * FROM reorder_requests WITH (UPDLOCK,HOLDLOCK) WHERE reorder_request_id=? AND supplier_id=?', [id, supplierId]);
    const request = rows[0]; if (!request) throw new ApiError('Supply request not found', 404);
    const [existing] = await connection.execute('SELECT * FROM supplier_responses WHERE reorder_request_id=?', [id]);
    if (existing[0]) {
      const prior = existing[0];
      const same = prior.response_status===data.status && Number(prior.available_quantity)===data.quantity
        && (prior.estimated_delivery_date ? new Date(prior.estimated_delivery_date).toISOString().slice(0,10) : null)===data.deliveryDate
        && (prior.unit_purchase_price==null ? null : Number(prior.unit_purchase_price))===data.price
        && (prior.supplier_message || null)===(data.message || null);
      if (!same) throw new ApiError('A response already exists for this request', 409);
      return;
    }
    if (request.status !== 'OPEN') throw new ApiError('Request is no longer open', 409);
    if (data.status==='AVAILABLE' && data.quantity<request.requested_quantity) throw new ApiError('Use partially available when fewer units can be supplied', 400);
    if (data.status==='PARTIALLY_AVAILABLE' && data.quantity>=request.requested_quantity) throw new ApiError('Partial quantity must be less than requested quantity', 400);
    await connection.execute(`INSERT INTO supplier_responses (reorder_request_id,supplier_id,medicine_id,responded_by,available_quantity,estimated_delivery_date,unit_purchase_price,supplier_message,response_status)
      VALUES (?,?,?,?,?,?,?,?,?)`, [id,supplierId,request.medicine_id,user.userId,data.quantity,data.deliveryDate,data.price,data.message,data.status]);
    await notify(connection, { staff:true,type:'SUPPLIER_RESPONSE',title:'Supplier availability received',message:`Supply request ${id}: ${data.status}, ${data.quantity} units`,entityType:'REORDER_REQUEST',entityId:id,key:`supply-response:${id}` });
  });
  return getRequest(id, supplierId);
}

async function approve(id, actorUserId, { quantity, price, reject = false }) {
  const orderId = await transaction(async connection => {
    const [requests] = await connection.execute('SELECT * FROM reorder_requests WITH (UPDLOCK,HOLDLOCK) WHERE reorder_request_id=?', [id]);
    const request = requests[0]; if (!request) throw new ApiError('Supply request not found', 404);
    const [responses] = await connection.execute('SELECT * FROM supplier_responses WITH (UPDLOCK,HOLDLOCK) WHERE reorder_request_id=?', [id]);
    const response = responses[0]; if (!response) throw new ApiError('Supplier response is required', 409);
    const [orders] = await connection.execute('SELECT purchase_order_id FROM purchase_orders WHERE reorder_request_id=?', [id]);
    if (orders[0]) { if (reject) throw new ApiError('An ordered request cannot be rejected',409); return orders[0].purchase_order_id; }
    if (response.approval_status==='REJECTED' && reject) return null;
    if (request.status!=='OPEN' || response.approval_status!=='PENDING') throw new ApiError('Response is no longer awaiting approval',409);
    if (reject) {
      await connection.execute("UPDATE supplier_responses SET approval_status='REJECTED',reviewed_by=?,reviewed_at=SYSDATETIME() WHERE reorder_request_id=?",[actorUserId,id]);
      await connection.execute("UPDATE reorder_requests SET status='CANCELLED',resolved_at=SYSDATETIME() WHERE reorder_request_id=?",[id]);
      await notify(connection,{supplierId:request.supplier_id,type:'SUPPLY_REJECTED',title:'Supply request closed',message:`Request ${id} was closed by purchasing staff`,entityType:'REORDER_REQUEST',entityId:id,key:`supply-rejected:${id}`});
      return null;
    }
    if(response.response_status==='UNAVAILABLE') throw new ApiError('An unavailable response cannot be approved',409);
    const approvedQuantity=quantity ?? Math.min(request.requested_quantity,response.available_quantity);
    const unitPrice=price ?? (response.unit_purchase_price==null ? null : Number(response.unit_purchase_price));
    if(!Number.isSafeInteger(approvedQuantity) || approvedQuantity<=0 || approvedQuantity>response.available_quantity || approvedQuantity>request.requested_quantity) throw new ApiError('Approved quantity exceeds the request or supplier availability',400);
    if(unitPrice==null || !Number.isFinite(unitPrice) || unitPrice<0 || Math.abs(unitPrice*100-Math.round(unitPrice*100))>0.000001) throw new ApiError('A valid approved unit purchase price is required',400);
    const [created]=await connection.execute(`INSERT INTO purchase_orders (supplier_id,reorder_request_id,supplier_response_id,expected_date,idempotency_key,created_by)
      OUTPUT INSERTED.purchase_order_id AS insertId VALUES (?,?,?,?,?,?)`,[request.supplier_id,id,response.supplier_response_id,response.estimated_delivery_date,`reorder:${id}`,actorUserId]);
    await connection.execute('INSERT INTO purchase_order_items (purchase_order_id,medicine_id,ordered_quantity,unit_cost) VALUES (?,?,?,?)',[created.insertId,request.medicine_id,approvedQuantity,unitPrice]);
    await connection.execute("UPDATE supplier_responses SET approval_status='APPROVED',reviewed_by=?,reviewed_at=SYSDATETIME() WHERE reorder_request_id=?",[actorUserId,id]);
    await connection.execute("UPDATE reorder_requests SET status='ORDERED' WHERE reorder_request_id=?",[id]);
    await notify(connection,{supplierId:request.supplier_id,type:'PURCHASE_ORDER',title:'Purchase order created',message:`Request ${id}: ${approvedQuantity} units approved; order awaiting dispatch`,entityType:'PURCHASE_ORDER',entityId:created.insertId,key:`supply-order:${created.insertId}`});
    return created.insertId;
  });
  return { request: await getRequest(id), purchase_order_id: orderId };
}

async function saveSettings(medicineId, { supplierId, reorderTarget, autoReorder }, actorUserId) {
  await transaction(async connection => {
    const [medicines] = await connection.execute('SELECT id,min_stock_level FROM medicines WITH (UPDLOCK,HOLDLOCK) WHERE id=? AND is_active=1',[medicineId]);
    if(!medicines[0]) throw new ApiError('Active medicine not found',404);
    if(reorderTarget!=null && reorderTarget<=medicines[0].min_stock_level) throw new ApiError('Reorder target must exceed the minimum stock level',400);
    if(autoReorder && (!supplierId || !reorderTarget)) throw new ApiError('Automatic reorders require a supplier and reorder target',400);
    if(supplierId) {
      const [suppliers]=await connection.execute('SELECT id FROM suppliers WHERE id=?',[supplierId]); if(!suppliers[0]) throw new ApiError('Supplier not found',404);
      await connection.execute('UPDATE supplier_medicines SET is_preferred=0 WHERE medicine_id=?',[medicineId]);
      const [mapped]=await connection.execute('SELECT supplier_medicine_id FROM supplier_medicines WHERE medicine_id=? AND supplier_id=?',[medicineId,supplierId]);
      if(mapped[0]) await connection.execute('UPDATE supplier_medicines SET is_preferred=1,is_active=1 WHERE supplier_medicine_id=?',[mapped[0].supplier_medicine_id]);
      else await connection.execute('INSERT INTO supplier_medicines (medicine_id,supplier_id,is_preferred) VALUES (?,?,1)',[medicineId,supplierId]);
    }
    await connection.execute('UPDATE medicines SET reorder_target=?,auto_reorder_enabled=? WHERE id=?',[reorderTarget,autoReorder,medicineId]);
    await checkLowStock(connection,[medicineId],actorUserId);
  });
  return getSettings(medicineId);
}

async function getSettings(medicineId) {
  const [rows]=await pool.execute('SELECT * FROM v_inventory_supply_stock WHERE medicine_id=?',[medicineId]);
  if(!rows[0]) throw new ApiError('Medicine not found',404);
  const [suppliers]=await pool.execute('SELECT sm.*,s.company_name FROM supplier_medicines sm JOIN suppliers s ON s.id=sm.supplier_id WHERE sm.medicine_id=? AND sm.is_active=1 ORDER BY sm.is_preferred DESC,sm.supplier_id',[medicineId]);
  return {...rows[0],suppliers};
}

async function accounts() {
  const [rows]=await pool.execute("SELECT u.user_id,u.username,su.supplier_id,s.company_name FROM users u LEFT JOIN supplier_users su ON su.user_id=u.user_id LEFT JOIN suppliers s ON s.id=su.supplier_id WHERE u.role='SUPPLIER' ORDER BY u.username"); return rows;
}

async function linkAccount(userId,supplierId,actorUserId) {
  await transaction(async connection => {
    const [users]=await connection.execute("SELECT user_id FROM users WITH (UPDLOCK,HOLDLOCK) WHERE user_id=? AND role='SUPPLIER'",[userId]); if(!users[0]) throw new ApiError('Supplier login not found',404);
    const [suppliers]=await connection.execute('SELECT id FROM suppliers WHERE id=?',[supplierId]); if(!suppliers[0]) throw new ApiError('Supplier not found',404);
    const [existing]=await connection.execute('SELECT supplier_id FROM supplier_users WHERE user_id=?',[userId]);
    if(existing[0] && Number(existing[0].supplier_id)!==supplierId) throw new ApiError('This login is already linked to another supplier. Use a separate supplier login',409);
    if(!existing[0]) await connection.execute('INSERT INTO supplier_users (user_id,supplier_id,linked_by) VALUES (?,?,?)',[userId,supplierId,actorUserId]);
    const [requests]=await connection.execute("SELECT reorder_request_id FROM reorder_requests WHERE supplier_id=? AND status='OPEN'",[supplierId]);
    for(const request of requests) await notifyRequest(connection,request.reorder_request_id);
  });
  return (await accounts()).find(account=>account.user_id===userId);
}

async function notifyOrderStatus(connection, orderId, status) {
  const [orders]=await connection.execute('SELECT supplier_id,reorder_request_id,purchase_order_number FROM purchase_orders WHERE purchase_order_id=?',[orderId]);
  const order=orders[0]; if(!order?.reorder_request_id) return;
  if(status==='CANCELLED') await connection.execute("UPDATE reorder_requests SET status='CANCELLED',resolved_at=SYSDATETIME() WHERE reorder_request_id=? AND status='ORDERED'",[order.reorder_request_id]);
  await notify(connection,{supplierId:order.supplier_id,type:'PURCHASE_ORDER',title:`Purchase order ${status.toLowerCase()}`,message:`${order.purchase_order_number}: ${status}`,entityType:'PURCHASE_ORDER',entityId:orderId,key:`supply-order-status:${orderId}:${status}`});
}

module.exports={transaction,supplierScope,notify,notifyRequest,lowStock,listRequests,getRequest,createRequest,createRequestInTransaction,checkLowStock,respond,approve,saveSettings,getSettings,accounts,linkAccount,notifyOrderStatus};
