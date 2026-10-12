const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { closePool, pool } = require('../config/database');
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../config/jwt');
const storage = require('../services/prescriptionFileStorage');

const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//9k=',
  'base64'
);
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const createdUserIds = [];
const createdCustomerIds = [];
const createdUploadIds = [];
const createdStoragePaths = [];
let fixtureDirectory;
let server;

const tokenFor = userId => jwt.sign(
  { userId },
  getJwtSecret(),
  { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '10m' }
);

async function createCustomerIdentity(label) {
  const unique = crypto.randomUUID().replace(/-/g, '');
  const [userResult] = await pool.execute(
    'INSERT INTO users (username, password, role) OUTPUT INSERTED.user_id AS insertId VALUES (?, ?, ?)',
    [`a3_${label}_${unique}`, 'a3-live-verification-not-a-login-credential', 'CUSTOMER']
  );
  createdUserIds.push(userResult.insertId);
  const [customerResult] = await pool.execute(
    'INSERT INTO customers (user_id, first_name, last_name, email) OUTPUT INSERTED.id AS insertId VALUES (?, ?, ?, ?)',
    [userResult.insertId, 'A3', label, `a3_${label}_${unique}@example.invalid`]
  );
  createdCustomerIds.push(customerResult.insertId);
  return { userId: userResult.insertId, customerId: customerResult.insertId, token: tokenFor(userResult.insertId) };
}

async function uploadFile(baseUrl, token, filePath, mimeType, filename) {
  const form = new FormData();
  form.append('file', new Blob([await fs.readFile(filePath)], { type: mimeType }), filename);
  form.append('doctorName', 'A3 Test Doctor');
  form.append('notes', 'Temporary A3 verification row');
  return fetch(`${baseUrl}/api/prescriptions/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

async function cleanup() {
  if (server) await new Promise(resolve => server.close(resolve));
  if (createdCustomerIds.length) {
    const placeholders = createdCustomerIds.map(() => '?').join(', ');
    const [rows] = await pool.execute(
      `SELECT storage_path FROM prescription_uploads WHERE customer_id IN (${placeholders})`,
      createdCustomerIds
    );
    for (const row of rows) if (row.storage_path) createdStoragePaths.push(row.storage_path);
    await pool.execute(`DELETE FROM prescription_uploads WHERE customer_id IN (${placeholders})`, createdCustomerIds);
    await pool.execute(`DELETE FROM customers WHERE id IN (${placeholders})`, createdCustomerIds);
  }
  if (createdUserIds.length) {
    const placeholders = createdUserIds.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM users WHERE user_id IN (${placeholders})`, createdUserIds);
  }
  for (const storagePath of new Set(createdStoragePaths)) await storage.deleteFile(storagePath);
  if (fixtureDirectory) await fs.rm(fixtureDirectory, { recursive: true, force: true });
}

async function run() {
  let failure;
  try {
    fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'prescription-live-'));
    const jpegPath = path.join(fixtureDirectory, 'actual.jpg');
    const pngPath = path.join(fixtureDirectory, 'actual.png');
    await fs.writeFile(jpegPath, JPEG_BYTES);
    await fs.writeFile(pngPath, PNG_BYTES);

    const owner = await createCustomerIdentity('owner');
    const otherCustomer = await createCustomerIdentity('other');
    const [staff] = await pool.execute(
      "SELECT user_id, role FROM users WHERE role IN ('PHARMACIST', 'INVENTORY') ORDER BY CASE role WHEN 'PHARMACIST' THEN 1 ELSE 2 END"
    );
    const pharmacist = staff.find(user => user.role === 'PHARMACIST');
    const unrelated = staff.find(user => user.role === 'INVENTORY');
    assert.ok(pharmacist, 'A PHARMACIST user is required for live verification');
    assert.ok(unrelated, 'An INVENTORY user is required for live verification');

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    let response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);

    response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    assert.equal(response.status, 200);
    const currentIdentity = await response.json();
    assert.equal(currentIdentity.data.customerId, owner.customerId);

    response = await fetch(`${baseUrl}/api/medicines`, {
      headers: { Authorization: `Bearer ${tokenFor(pharmacist.user_id)}` },
    });
    assert.equal(response.status, 200);

    const jpegResponse = await uploadFile(baseUrl, owner.token, jpegPath, 'image/jpeg', '../../unsafe-name.jpg');
    assert.equal(jpegResponse.status, 201);
    const jpegBody = await jpegResponse.json();
    createdUploadIds.push(jpegBody.data.id);

    const pngResponse = await uploadFile(baseUrl, owner.token, pngPath, 'image/png', 'actual.png');
    assert.equal(pngResponse.status, 201);
    const pngBody = await pngResponse.json();
    createdUploadIds.push(pngBody.data.id);

    const placeholders = createdUploadIds.map(() => '?').join(', ');
    const [metadataRows] = await pool.execute(
      `SELECT prescription_id, customer_id, image, original_filename, stored_filename, storage_path, mime_type, file_size
       FROM prescription_uploads WHERE prescription_id IN (${placeholders}) ORDER BY prescription_id`,
      createdUploadIds
    );
    assert.equal(metadataRows.length, 2);
    for (const row of metadataRows) {
      assert.equal(row.customer_id, owner.customerId);
      assert.equal(row.image, null);
      assert.equal(path.isAbsolute(row.storage_path), false);
      assert.match(row.storage_path, /^prescriptions\/[0-9a-f-]+\.(jpg|png)$/i);
      assert.notEqual(row.stored_filename, row.original_filename);
      createdStoragePaths.push(row.storage_path);
      await fs.access(storage.resolveStoragePath(row.storage_path));
    }
    assert.equal(metadataRows[0].original_filename, 'unsafe-name.jpg');

    const fileUrl = `${baseUrl}/api/prescription-uploads/${jpegBody.data.id}/file`;
    response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${owner.token}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), JPEG_BYTES);

    response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${tokenFor(pharmacist.user_id)}` } });
    assert.equal(response.status, 200);

    response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${otherCustomer.token}` } });
    assert.equal(response.status, 403);

    response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${tokenFor(unrelated.user_id)}` } });
    assert.equal(response.status, 403);

    response = await fetch(fileUrl);
    assert.equal(response.status, 401);

    response = await fetch(`${baseUrl}/uploads/${metadataRows[0].storage_path}`);
    assert.equal(response.status, 404);

    let form = new FormData();
    form.append('notes', 'missing file');
    response = await fetch(`${baseUrl}/api/prescriptions/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: form,
    });
    assert.equal(response.status, 400);

    form = new FormData();
    form.append('file', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'not-image.txt');
    response = await fetch(`${baseUrl}/api/prescriptions/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: form,
    });
    assert.equal(response.status, 415);

    form = new FormData();
    form.append('file', new Blob([Buffer.from('%PDF-1.4\n')], { type: 'application/pdf' }), 'scan.pdf');
    response = await fetch(`${baseUrl}/api/prescriptions/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: form,
    });
    assert.equal(response.status, 415);

    form = new FormData();
    form.append('file', new Blob([Buffer.alloc(storage.MAX_FILE_BYTES + 1, 1)], { type: 'image/jpeg' }), 'oversized.jpg');
    response = await fetch(`${baseUrl}/api/prescriptions/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: form,
    });
    assert.equal(response.status, 413);

    response = await fetch(`${baseUrl}/api/prescriptions/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${owner.token}`,
        'Content-Type': 'multipart/form-data; boundary=broken',
      },
      body: '--broken\r\nmalformed',
    });
    assert.equal(response.status, 400);

    console.log('PASS: health, medicines, auth/me, JPEG/PNG storage, authorization, validation, and private retrieval');
  } catch (error) {
    failure = error;
  }

  try {
    await cleanup();
    if (createdUploadIds.length) {
      const placeholders = createdUploadIds.map(() => '?').join(', ');
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS count FROM prescription_uploads WHERE prescription_id IN (${placeholders})`,
        createdUploadIds
      );
      assert.equal(rows[0].count, 0);
    }
    for (const storagePath of new Set(createdStoragePaths)) {
      await assert.rejects(fs.access(storage.resolveStoragePath(storagePath)), error => error.code === 'ENOENT');
    }
    console.log('PASS: temporary database rows, identities, fixture files, and stored files cleaned');
  } catch (cleanupError) {
    failure = failure || cleanupError;
  }

  try {
    await closePool();
  } catch (closeError) {
    failure = failure || closeError;
  }

  if (failure) throw failure;
}

run().catch(error => {
  console.error(`Live prescription verification failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
