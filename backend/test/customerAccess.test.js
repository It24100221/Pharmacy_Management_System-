const test = require('node:test');
const assert = require('node:assert/strict');

const prescriptionController = require('../src/controllers/prescriptionUploadController');
const prescriptionRepository = require('../src/repositories/prescriptionRepository');
const orderController = require('../src/controllers/orderController');
const orderRepository = require('../src/repositories/orderRepository');

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; resolve({ res: this, body }); return this; },
  };
  handler(req, res, error => error ? reject(error) : resolve({ res, body: res.body }));
});

test('customer can load own prescriptions and cannot select another customer', async () => {
  const original = prescriptionRepository.findUploadsByCustomer;
  let requestedCustomerId;
  prescriptionRepository.findUploadsByCustomer = async customerId => {
    requestedCustomerId = customerId;
    return [{ prescription_id: 4, customer_id: customerId, status: 'APPROVED' }];
  };
  try {
    const own = await invoke(prescriptionController.getOwnUploads, { user: { role: 'CUSTOMER', customerId: 12 } });
    assert.equal(own.res.statusCode, 200);
    assert.equal(requestedCustomerId, 12);
    assert.equal(own.body.data.prescriptions[0].customer_id, 12);

    const other = await invoke(prescriptionController.getCustomerUploads, {
      user: { role: 'CUSTOMER', customerId: 12 },
      params: { id: '13' },
    });
    assert.equal(other.res.statusCode, 403);
    assert.equal(other.body.message, 'You can only view your own prescriptions');
    assert.equal(requestedCustomerId, 12);
  } finally {
    prescriptionRepository.findUploadsByCustomer = original;
  }
});

test('customer can load own orders and cannot open another customer order', async () => {
  const originalFindMine = orderRepository.findMine;
  const originalFindById = orderRepository.findById;
  orderRepository.findMine = async customerId => [{ order_id: 8, customer_id: customerId, status: 'READY_FOR_BILLING' }];
  orderRepository.findById = async () => ({ order_id: 9, customer_id: 13, status: 'READY_FOR_BILLING' });
  try {
    const own = await invoke(orderController.getMine, { user: { role: 'CUSTOMER', customerId: 12 } });
    assert.equal(own.res.statusCode, 200);
    assert.equal(own.body.data.orders[0].customer_id, 12);

    await assert.rejects(
      invoke(orderController.getById, { user: { role: 'CUSTOMER', customerId: 12 }, params: { id: '9' } }),
      error => error.statusCode === 403 && error.message === 'You can only view your own orders'
    );
  } finally {
    orderRepository.findMine = originalFindMine;
    orderRepository.findById = originalFindById;
  }
});
