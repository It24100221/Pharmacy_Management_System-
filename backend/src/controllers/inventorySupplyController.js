const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const supply = require('../services/inventorySupply');
const {parsePositiveInteger,isIsoDate,todayInTimeZone}=require('../utils/requestValidation');

const date = value => { if(value==null || value==='') return null; if(!isIsoDate(value) || value<todayInTimeZone()) throw new ApiError('Delivery date must be a valid date today or later',400); return value; };
const price = value => { if(value==null || value==='') return null; const amount=Number(value); if(!Number.isFinite(amount) || amount<0 || amount>9999999999.99 || Math.abs(amount*100-Math.round(amount*100))>0.000001) throw new ApiError('Unit purchase price must be non-negative with at most two decimals',400); return amount; };
const message = value => { if(value==null || value==='') return null; if(typeof value!=='string' || value.trim().length>1000) throw new ApiError('Message must not exceed 1000 characters',400); return value.trim() || null; };

exports.lowStock=asyncHandler(async(req,res)=>res.json({success:true,data:{medicines:await supply.lowStock()}}));
exports.list=asyncHandler(async(req,res)=>{
  const supplierId=supply.supplierScope(req.user); const status=req.query.status || null;
  if(status && !['OPEN','ORDERED','CANCELLED','RECEIVED'].includes(status)) throw new ApiError('Invalid request status',400);
  res.json({success:true,data:{requests:await supply.listRequests({status,supplierId})}});
});
exports.get=asyncHandler(async(req,res)=>{
  const request=await supply.getRequest(parsePositiveInteger(req.params.id,'request ID'),supply.supplierScope(req.user));
  if(!request) throw new ApiError('Supply request not found',404);
  res.json({success:true,data:request});
});
exports.create=asyncHandler(async(req,res)=>{
  const body=req.body || {}; const priority=body.priority || 'NORMAL';
  if(!['NORMAL','URGENT'].includes(priority)) throw new ApiError('Invalid priority',400);
  const request=await supply.createRequest({medicineId:parsePositiveInteger(body.medicine_id,'medicine ID'),
    requestedQuantity:body.requested_quantity==null ? undefined : parsePositiveInteger(body.requested_quantity,'requested quantity'),
    requestedBy:req.user.userId,supplierId:body.supplier_id==null ? null : parsePositiveInteger(body.supplier_id,'supplier ID'),
    notes:message(body.notes),deliveryDate:date(body.requested_delivery_date),priority});
  res.status(201).json({success:true,data:request,message:request.supplier_account_count ? 'Supply request saved and supplier notified' : 'Supply request saved; administrator must link the supplier login before delivery'});
});
exports.respond=asyncHandler(async(req,res)=>{
  const body=req.body || {}; const status=body.response_status;
  if(!['AVAILABLE','PARTIALLY_AVAILABLE','UNAVAILABLE'].includes(status)) throw new ApiError('Invalid supplier response status',400);
  const quantity=Number(body.available_quantity);
  if(typeof body.available_quantity!=='number' && (typeof body.available_quantity!=='string' || !/^\d+$/.test(body.available_quantity))) throw new ApiError('Available quantity must be a non-negative whole number',400);
  if(body.available_quantity===undefined || body.available_quantity===null || body.available_quantity==='' || !Number.isSafeInteger(quantity) || quantity<0) throw new ApiError('Available quantity must be a non-negative whole number',400);
  const deliveryDate=date(body.estimated_delivery_date);
  if((status==='UNAVAILABLE' && quantity!==0) || (status!=='UNAVAILABLE' && (quantity===0 || !deliveryDate))) throw new ApiError('Availability requires a positive quantity and delivery date; unavailable requires zero quantity',400);
  res.json({success:true,data:await supply.respond(parsePositiveInteger(req.params.id,'request ID'),req.user,{status,quantity,deliveryDate,price:price(body.unit_purchase_price),message:message(body.supplier_message)})});
});
exports.review=asyncHandler(async(req,res)=>{
  const body=req.body || {}; if(!['APPROVE','REJECT'].includes(body.decision)) throw new ApiError('Choose APPROVE or REJECT',400);
  const data=await supply.approve(parsePositiveInteger(req.params.id,'request ID'),req.user.userId,{reject:body.decision==='REJECT',quantity:body.approved_quantity==null ? undefined : parsePositiveInteger(body.approved_quantity,'approved quantity'),price:price(body.unit_purchase_price)});
  res.json({success:true,data,message:body.decision==='REJECT' ? 'Response rejected and request closed' : 'Response approved; draft purchase order created'});
});
exports.settings=asyncHandler(async(req,res)=>res.json({success:true,data:await supply.getSettings(parsePositiveInteger(req.params.id,'medicine ID'))}));
exports.saveSettings=asyncHandler(async(req,res)=>{
  const body=req.body || {}; if(typeof body.auto_reorder_enabled!=='boolean') throw new ApiError('Automatic reorder setting must be true or false',400);
  const data=await supply.saveSettings(parsePositiveInteger(req.params.id,'medicine ID'),{
    supplierId:body.supplier_id==null || body.supplier_id==='' ? null : parsePositiveInteger(body.supplier_id,'supplier ID'),
    reorderTarget:body.reorder_target==null || body.reorder_target==='' ? null : parsePositiveInteger(body.reorder_target,'reorder target'),autoReorder:body.auto_reorder_enabled},req.user.userId);
  res.json({success:true,data});
});
exports.accounts=asyncHandler(async(req,res)=>res.json({success:true,data:{accounts:await supply.accounts()}}));
exports.linkAccount=asyncHandler(async(req,res)=>res.json({success:true,data:await supply.linkAccount(parsePositiveInteger(req.params.userId,'supplier user ID'),parsePositiveInteger(req.body?.supplier_id,'supplier ID'),req.user.userId)}));

exports.createAccount=asyncHandler(async(req,res)=>{
  const {username,password,supplier_id}=req.body || {};
  if(typeof username!=='string' || !/^[A-Za-z0-9_.-]{3,50}$/.test(username)) throw new ApiError('Username must be 3–50 letters, digits, dots, underscores or hyphens',400);
  if(typeof password!=='string' || password.length<12 || Buffer.byteLength(password)>72) throw new ApiError('Password must contain at least 12 characters and at most 72 bytes',400);
  const supplierId=parsePositiveInteger(supplier_id,'supplier ID');
  const hash=await require('bcryptjs').hash(password,12);
  const userId=await supply.transaction(async connection=>{
    const [suppliers]=await connection.execute('SELECT id FROM suppliers WHERE id=?',[supplierId]); if(!suppliers[0]) throw new ApiError('Supplier not found',404);
    const [users]=await connection.execute('SELECT user_id FROM users WITH (UPDLOCK,HOLDLOCK) WHERE username=?',[username]); if(users[0]) throw new ApiError('Username already exists',409);
    const [created]=await connection.execute("INSERT INTO users (username,password,role) OUTPUT INSERTED.user_id AS insertId VALUES (?,?,'SUPPLIER')",[username,hash]);
    await connection.execute('INSERT INTO supplier_users (user_id,supplier_id,linked_by) VALUES (?,?,?)',[created.insertId,supplierId,req.user.userId]);
    const [requests]=await connection.execute("SELECT reorder_request_id FROM reorder_requests WHERE supplier_id=? AND status='OPEN'",[supplierId]);
    for(const request of requests) await supply.notifyRequest(connection,request.reorder_request_id);
    return created.insertId;
  });
  res.status(201).json({success:true,data:{user_id:userId,username,supplier_id:supplierId}});
});
