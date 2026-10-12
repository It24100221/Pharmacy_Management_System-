// Isolated integration tests: never point this script at the live database.
if (process.env.DB_NAME !== 'pharmacy_management_test') throw new Error('Set DB_NAME=pharmacy_management_test; live databases are refused');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, closePool } = require('../config/database');
const app = require('../app');
const supply = require('../services/inventorySupply');
const marker = `supply_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
const results = [];
let server; let base; let fixture;
const check = async (name, action) => { try { await action(); results.push({ name, passed: true }); } catch(error) { results.push({name,passed:false,error:error.message}); throw error; } };
const raw = async (route, token, method='GET', body) => {
  const response = await fetch(base+route,{method,headers:{...(token ? {Authorization:`Bearer ${token}`} : {}),...(body ? {'Content-Type':'application/json'} : {})},body:body ? JSON.stringify(body) : undefined});
  return {status:response.status,body:await response.json()};
};
const api = async (route, token, method='GET', body, expected=200) => {const response=await raw(route,token,method,body); assert.equal(response.status,expected,`${method} ${route}: ${JSON.stringify(response.body)}`); return response.body.data;};
const login = async (username,password) => api('/auth/staff-login',null,'POST',{username,password});
const stock = async medicineId => (await pool.execute('SELECT quantity FROM medicines WHERE id=?',[medicineId]))[0][0].quantity;

async function run() {
  server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve)); base=`http://127.0.0.1:${server.address().port}/api`;
  const password=crypto.randomBytes(24).toString('base64url'); const hash=await bcrypt.hash(password,12);
  const staff={};
  for(const role of ['ADMIN','INVENTORY','SALES']) {
    const username=`${marker}_${role.toLowerCase()}`;
    const [created]=await pool.execute('INSERT INTO users (username,password,role) OUTPUT INSERTED.user_id AS insertId VALUES (?,?,?)',[username,hash,role]);
    staff[role]=await login(username,password); assert.equal(staff[role].userId,created.insertId);
  }
  const admin=staff.ADMIN.token, inventory=staff.INVENTORY.token;
  const suppliers=[]; const supplierSessions=[];
  for(let i=0;i<2;i++) {
    const company=await api('/suppliers',admin,'POST',{company_name:`${marker}_company_${i}`},201); suppliers.push(company);
    await api('/suppliers/accounts',admin,'POST',{supplier_id:company.id,username:`${marker}_supplier_${i}`,password},201);
    supplierSessions.push(await login(`${marker}_supplier_${i}`,password));
  }
  const supplier=supplierSessions[0].token, other=supplierSessions[1].token;
  const createMedicine=async (suffix,quantity=8,min=20)=>api('/medicines',inventory,'POST',{name:`${marker}_${suffix}`,generic_name:`${marker}_${suffix}`,manufacturer:'Integration verification',batch_number:`${marker}_${suffix}`,category:'Verification',quantity,unit_price:20,expiry_date:'2099-12-31',min_stock_level:min},201);
  const settings=async (id, supplierId=suppliers[0].id,auto=false,target=100)=>api(`/medicines/${id}/supply-settings`,inventory,'PUT',{supplier_id:supplierId,reorder_target:target,auto_reorder_enabled:auto});
  const medicine=await createMedicine('main'); const medicineId=medicine.id;
  let request; let order; let receipt;
  await check('configured reorder target generates actual 92-unit request from sellable stock 8',async()=>{
    await settings(medicineId); request=await api('/reorder-requests',inventory,'POST',{medicine_id:medicineId,priority:'URGENT',requested_delivery_date:'2099-02-01'},201);
    assert.equal(request.requested_quantity,92); assert.equal(request.available_quantity,8); assert.equal(request.supplier_id,suppliers[0].id); assert.ok(request.product_code); assert.equal(request.priority,'URGENT');
  });
  await check('automatic detection and concurrent retries keep one open request and one notification per recipient',async()=>{
    await settings(medicineId,suppliers[0].id,true);
    const duplicates=await Promise.all(Array.from({length:3},()=>api('/reorder-requests',inventory,'POST',{medicine_id:medicineId},201)));
    assert.ok(duplicates.every(item=>item.reorder_request_id===request.reorder_request_id));
    const [rows]=await pool.execute("SELECT COUNT(*) AS total FROM reorder_requests WHERE medicine_id=? AND supplier_id=? AND status='OPEN'",[medicineId,suppliers[0].id]); assert.equal(rows[0].total,1);
    const [notes]=await pool.execute("SELECT COUNT(*) AS total FROM notifications WHERE recipient_user_id=? AND entity_type='REORDER_REQUEST' AND entity_id=?",[supplierSessions[0].userId,request.reorder_request_id]);assert.equal(notes[0].total,1);
  });
  let notification;
  await check('supplier receives persisted medicine-specific notification and unread count',async()=>{
    const data=await api('/notifications',supplier); notification=data.notifications.find(item=>item.entity_type==='REORDER_REQUEST' && item.entity_id===request.reorder_request_id);
    assert.ok(notification); assert.equal(notification.title,'Low Stock – Medicine Supply Request'); assert.match(notification.message,/Requested quantity: 92/); assert.match(notification.message,new RegExp(medicine.name)); assert.ok(data.unread_count>=1);
    const details=await api(`/reorder-requests/${request.reorder_request_id}`,supplier);assert.equal(details.medicine_id,medicineId);assert.equal(details.medicine_name,medicine.name);
  });
  await check('supplier ownership blocks cross-company reads, notifications, orders, inventory and mutations',async()=>{
    assert.deepEqual((await api('/reorder-requests',other)).requests,[]);
    await api(`/reorder-requests/${request.reorder_request_id}`,other,'GET',undefined,404);
    await api(`/reorder-requests/${request.reorder_request_id}/respond`,other,'POST',{response_status:'UNAVAILABLE',available_quantity:0},404);
    await api(`/notifications/${notification.notification_id}/read`,other,'PATCH',{},404);
    assert.equal((await api('/notifications',other)).notifications.length,0);
    assert.deepEqual((await api('/suppliers',supplier)).suppliers.map(row=>row.id),[suppliers[0].id]);
    await api(`/suppliers/${suppliers[0].id}`,other,'GET',undefined,404);
    for(const route of ['/medicines','/supplier-inquiries','/supplier-invoices','/goods-receipts','/suppliers/accounts']) await api(route,supplier,'GET',undefined,403);
    await api('/reorder-requests',supplier,'POST',{medicine_id:medicineId},403);
    await api('/suppliers/accounts',inventory,'POST',{supplier_id:suppliers[0].id,username:'unauthorized',password},403);
    assert.equal((await api(`/reorder-requests?supplier_id=${suppliers[0].id}`,other)).requests.length,0);
  });
  await check('read state persists and another supplier cannot change it',async()=>{
    await api(`/notifications/${notification.notification_id}/read`,supplier,'PATCH',{});
    assert.ok((await api('/notifications',supplier)).notifications.find(item=>item.notification_id===notification.notification_id).read_at);
    assert.ok((await pool.execute('SELECT read_at FROM notifications WHERE notification_id=?',[notification.notification_id]))[0][0].read_at);
  });
  const response={response_status:'AVAILABLE',available_quantity:92,estimated_delivery_date:'2099-02-01',unit_purchase_price:12.25,supplier_message:'Available for delivery'};
  await check('supplier response validates quantities, dates, availability status and immutable ownership',async()=>{
    for(const bad of [{available_quantity:-1},{available_quantity:1.5},{estimated_delivery_date:'2026-02-30'},{estimated_delivery_date:'2000-01-01'},{available_quantity:10}]) await api(`/reorder-requests/${request.reorder_request_id}/respond`,supplier,'POST',{...response,...bad},400);
    const saved=await api(`/reorder-requests/${request.reorder_request_id}/respond`,supplier,'POST',{...response,supplier_id:suppliers[1].id,medicine_id:999999});
    assert.equal(saved.response_status,'AVAILABLE');
    const [rows]=await pool.execute('SELECT supplier_id,medicine_id,responded_by FROM supplier_responses WHERE reorder_request_id=?',[request.reorder_request_id]);assert.deepEqual(rows[0],{supplier_id:suppliers[0].id,medicine_id:medicineId,responded_by:supplierSessions[0].userId});
  });
  await check('duplicate identical responses are idempotent; changed confirmations are refused',async()=>{
    await api(`/reorder-requests/${request.reorder_request_id}/respond`,supplier,'POST',response);
    await api(`/reorder-requests/${request.reorder_request_id}/respond`,supplier,'POST',{...response,supplier_message:'Changed'},409);
    const [rows]=await pool.execute('SELECT COUNT(*) AS total FROM supplier_responses WHERE reorder_request_id=?',[request.reorder_request_id]);assert.equal(rows[0].total,1);
    assert.ok((await api('/notifications',inventory)).notifications.some(item=>item.notification_type==='SUPPLIER_RESPONSE' && item.entity_id===request.reorder_request_id));
  });
  await check('staff approval creates exactly one linked purchase order without increasing stock',async()=>{
    const approval=await api(`/reorder-requests/${request.reorder_request_id}/review`,inventory,'POST',{decision:'APPROVE'});
    order=await api(`/purchase-orders/${approval.purchase_order_id}`,inventory);assert.equal(order.status,'DRAFT');assert.equal(order.items[0].ordered_quantity,92);assert.equal(order.reorder_request_id,request.reorder_request_id);
    const retry=await api(`/reorder-requests/${request.reorder_request_id}/review`,inventory,'POST',{decision:'APPROVE'});assert.equal(retry.purchase_order_id,order.purchase_order_id);assert.equal(await stock(medicineId),8);
    await api(`/reorder-requests/${request.reorder_request_id}/review`,inventory,'POST',{decision:'REJECT'},409);
    await api(`/purchase-orders/${order.purchase_order_id}`,other,'GET',undefined,404);
    assert.equal((await api('/purchase-orders',other)).purchase_orders.length,0);
  });
  await check('supplier confirms its own sent order and receipt statuses cannot be forged',async()=>{
    await api(`/purchase-orders/${order.purchase_order_id}/status`,inventory,'PATCH',{status:'SENT'});
    await api(`/purchase-orders/${order.purchase_order_id}/status`,other,'PATCH',{status:'CONFIRMED'},404);
    await api(`/purchase-orders/${order.purchase_order_id}/status`,supplier,'PATCH',{status:'CANCELLED'},403);
    await api(`/purchase-orders/${order.purchase_order_id}/status`,supplier,'PATCH',{status:'CONFIRMED'});
    await api(`/purchase-orders/${order.purchase_order_id}/status`,inventory,'PATCH',{status:'RECEIVED'},409);assert.equal(await stock(medicineId),8);
  });
  const delivery={purchase_order_id:order.purchase_order_id,idempotency_key:`${marker}:receipt`,items:[{purchase_order_item_id:order.items[0].purchase_order_item_id,quantity_received:92,batch_number:`${marker}_delivery`,expiry_date:'2099-12-31'}]};
  await check('expired delivery and over-receiving are rejected without inventory changes',async()=>{
    await api('/goods-receipts',inventory,'POST',{...delivery,items:[{...delivery.items[0],expiry_date:'2000-01-01'}]},400);
    await api('/goods-receipts',inventory,'POST',{...delivery,items:[{...delivery.items[0],quantity_received:93}]},409);assert.equal(await stock(medicineId),8);
  });
  await check('goods receipt increases stock exactly once from 8 to 100 and completes linked records',async()=>{
    receipt=await api('/goods-receipts',inventory,'POST',delivery,201); assert.equal(await stock(medicineId),100);
    const repeat=await api('/goods-receipts',inventory,'POST',delivery,201);assert.equal(repeat.goods_receipt_id,receipt.goods_receipt_id);assert.equal(await stock(medicineId),100);
    assert.equal((await api(`/purchase-orders/${order.purchase_order_id}`,inventory)).status,'RECEIVED');assert.equal((await api(`/reorder-requests/${request.reorder_request_id}`,supplier)).status,'RECEIVED');
    const [movements]=await pool.execute("SELECT quantity_delta,balance_after FROM stock_movements WHERE medicine_id=? AND reference_type='GOODS_RECEIPT'",[medicineId]);assert.deepEqual(movements,[{quantity_delta:92,balance_after:100}]);
    assert.ok((await api('/notifications',supplier)).notifications.some(item=>item.notification_type==='GOODS_RECEIPT' && item.entity_id===order.purchase_order_id));
  });
  await check('no supplier mapping and unlinked supplier logins produce explicit errors',async()=>{
    const unassigned=await createMedicine('unassigned',0);await api('/reorder-requests',inventory,'POST',{medicine_id:unassigned.id,requested_quantity:100},409);
    const [created]=await pool.execute("INSERT INTO users (username,password,role) OUTPUT INSERTED.user_id AS insertId VALUES (?,?,'SUPPLIER')",[`${marker}_unlinked`,hash]);
    const unlinked=await login(`${marker}_unlinked`,password);assert.equal(unlinked.userId,created.insertId);await api('/reorder-requests',unlinked.token,'GET',undefined,403);
    await api(`/suppliers/accounts/${created.insertId}`,admin,'PUT',{supplier_id:suppliers[1].id});assert.equal((await api('/reorder-requests',unlinked.token)).requests.length,0);
  });
  await check('zero stock, separate suppliers, partial response and partial delivery preserve isolation',async()=>{
    const med=await createMedicine('partial',0);await settings(med.id);
    await settings(med.id,suppliers[1].id); // Both mappings remain valid; latest is preferred.
    const a=await api('/reorder-requests',inventory,'POST',{medicine_id:med.id,supplier_id:suppliers[0].id},201);
    const b=await api('/reorder-requests',inventory,'POST',{medicine_id:med.id,supplier_id:suppliers[1].id},201);assert.notEqual(a.reorder_request_id,b.reorder_request_id);
    await api(`/reorder-requests/${a.reorder_request_id}/respond`,supplier,'POST',{response_status:'PARTIALLY_AVAILABLE',available_quantity:40,estimated_delivery_date:'2099-02-01',unit_purchase_price:10});
    const approved=await api(`/reorder-requests/${a.reorder_request_id}/review`,inventory,'POST',{decision:'APPROVE'});
    const po=await api(`/purchase-orders/${approved.purchase_order_id}`,inventory);assert.equal(po.items[0].ordered_quantity,40);
    await api(`/purchase-orders/${po.purchase_order_id}/status`,inventory,'PATCH',{status:'SENT'});await api(`/purchase-orders/${po.purchase_order_id}/status`,supplier,'PATCH',{status:'CONFIRMED'});
    const partialDelivery={purchase_order_id:po.purchase_order_id,idempotency_key:`${marker}:partial1`,items:[{purchase_order_item_id:po.items[0].purchase_order_item_id,quantity_received:15,batch_number:`${marker}_partial`,expiry_date:'2099-12-31'}]};
    await Promise.all([api('/goods-receipts',inventory,'POST',partialDelivery,201),api('/goods-receipts',inventory,'POST',partialDelivery,201)]);
    assert.equal(await stock(med.id),15);assert.equal((await api(`/purchase-orders/${po.purchase_order_id}`,inventory)).status,'PARTIALLY_RECEIVED');assert.equal((await api(`/reorder-requests/${a.reorder_request_id}`,supplier)).status,'ORDERED');
    await api('/goods-receipts',inventory,'POST',{...partialDelivery,idempotency_key:`${marker}:partial2`,items:[{...partialDelivery.items[0],quantity_received:25}]},201);
    assert.equal(await stock(med.id),40);assert.equal((await api(`/reorder-requests/${a.reorder_request_id}`,supplier)).status,'RECEIVED');assert.equal((await api(`/reorder-requests/${b.reorder_request_id}`,other)).status,'OPEN');
  });
  await check('unavailable response can be rejected; cancellation cannot create stock',async()=>{
    const med=await createMedicine('unavailable',0);await settings(med.id);
    const req=await api('/reorder-requests',inventory,'POST',{medicine_id:med.id},201);
    await api(`/reorder-requests/${req.reorder_request_id}/respond`,supplier,'POST',{response_status:'UNAVAILABLE',available_quantity:0,supplier_message:'No supply'});
    await api(`/reorder-requests/${req.reorder_request_id}/review`,inventory,'POST',{decision:'APPROVE'},409);
    await api(`/reorder-requests/${req.reorder_request_id}/review`,inventory,'POST',{decision:'REJECT'});assert.equal((await api(`/reorder-requests/${req.reorder_request_id}`,supplier)).status,'CANCELLED');assert.equal(await stock(med.id),0);
    await api(`/reorder-requests/${req.reorder_request_id}/respond`,supplier,'POST',{response_status:'AVAILABLE',available_quantity:100,estimated_delivery_date:'2099-02-01'},409);
  });
  await check('automatic requests are created after stock adjustment and sale at the threshold',async()=>{
    const med=await createMedicine('automatic',21);await settings(med.id,suppliers[0].id,true);
    await api(`/medicines/${med.id}/adjust-stock`,inventory,'POST',{batch_id:(await api(`/medicines/${med.id}/batches`,inventory)).batches[0].batch_id,quantity_delta:-1,reason:'Threshold verification',idempotency_key:`${marker}:adjust`},201);
    let req=(await api('/reorder-requests',inventory)).requests.find(item=>item.medicine_id===med.id);assert.ok(req);assert.equal(req.requested_quantity,80);
    await api(`/reorder-requests/${req.reorder_request_id}/status`,inventory,'PATCH',{status:'CANCELLED'});
    await api('/sales',staff.SALES.token,'POST',{items:[{medicine_id:med.id,quantity:1}],payment_method:'Cash',idempotency_key:`${marker}:sale`},201);
    req=(await api('/reorder-requests',inventory)).requests.find(item=>item.medicine_id===med.id && item.status==='OPEN');assert.ok(req);assert.equal(req.requested_quantity,81);assert.equal(await stock(med.id),19);
  });
  await check('expired and inactive batches are excluded from sellable stock',async()=>{
    const med=await createMedicine('expired',8);const batch=(await api(`/medicines/${med.id}/batches`,inventory)).batches[0];
    // Direct fixture mutation is confined to this newly created isolated test medicine.
    await pool.execute('UPDATE medicine_batches SET expiry_date=? WHERE batch_id=?',['2000-01-01',batch.batch_id]);
    await settings(med.id); const low=(await api('/reorder-requests/low-stock',inventory)).medicines.find(item=>item.medicine_id===med.id);assert.equal(low.available_quantity,0);assert.equal(low.physical_quantity,8);
    const req=await api('/reorder-requests',inventory,'POST',{medicine_id:med.id},201);assert.equal(req.requested_quantity,100);
    await pool.execute('UPDATE medicine_batches SET expiry_date=?,is_active=0 WHERE batch_id=?',['2099-12-31',batch.batch_id]);assert.equal((await supply.getSettings(med.id)).available_quantity,0);
  });
  await check('notification failure rolls back the entire request and retry delivers once',async()=>{
    const med=await createMedicine('notification_retry',0);await settings(med.id);
    await assert.rejects(supply.transaction(async connection=>{await supply.createRequestInTransaction(connection,{medicineId:med.id,requestedBy:staff.INVENTORY.userId,supplierId:suppliers[0].id});throw new Error('Simulated notification delivery transaction failure');}),/Simulated notification/);
    const [before]=await pool.execute('SELECT COUNT(*) AS total FROM reorder_requests WHERE medicine_id=?',[med.id]);assert.equal(before[0].total,0);
    const req=await api('/reorder-requests',inventory,'POST',{medicine_id:med.id},201);await api('/reorder-requests',inventory,'POST',{medicine_id:med.id},201);
    const [notifications]=await pool.execute('SELECT COUNT(*) AS total FROM notifications WHERE recipient_user_id=? AND entity_id=? AND notification_type=?',[supplierSessions[0].userId,req.reorder_request_id,'SUPPLY_REQUEST']);assert.equal(notifications[0].total,1);
  });
  await check('database connection failure produces a controlled API error and no fake success',async()=>{
    const original=pool.getConnection;pool.getConnection=async()=>{const error=new Error('Simulated database unavailable');error.statusCode=503;throw error;};
    try {await api('/reorder-requests',inventory,'POST',{medicine_id:medicineId},503);}finally{pool.getConnection=original;}
    assert.equal(await stock(medicineId),100);
  });
  await check('server restart retains supplier ownership, response, notifications and received stock',async()=>{
    await new Promise(resolve=>server.close(resolve));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/api`;
    assert.equal((await api(`/reorder-requests/${request.reorder_request_id}`,supplier)).status,'RECEIVED');assert.equal(await stock(medicineId),100);assert.ok((await api('/notifications',supplier)).notifications.length>0);
  });
  // Store non-secret fixture references for optional browser verification. Tokens/passwords are never persisted here.
  fixture={marker,medicineId,requestId:request.reorder_request_id,orderId:order.purchase_order_id,staffUserIds:Object.fromEntries(Object.entries(staff).map(([role,session])=>[role,session.userId])),supplierUserIds:supplierSessions.map(session=>session.userId),supplierIds:suppliers.map(company=>company.id)};
}

run().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));await closePool();
  const report={database:'pharmacy_management_test',liveDatabaseWrites:0,marker,summary:{total:results.length,passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed).length},results,fixture};
  const directory=path.resolve(__dirname,'../../.local');await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'supplier-integration-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
});
