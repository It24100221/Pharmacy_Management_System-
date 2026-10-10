const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const Module = require('node:module');

const repositoryPath = require.resolve('../src/repositories/prescriptionRepository');
const originalRepository = require.cache[repositoryPath];
const repositoryStub = new Module(repositoryPath);
repositoryStub.filename = repositoryPath;
repositoryStub.loaded = true;
repositoryStub.exports = {};
require.cache[repositoryPath] = repositoryStub;

const storage = require('../src/services/prescriptionFileStorage');
const { persistPrescriptionUpload } = require('../src/controllers/prescriptionUploadController');

const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//9k=',
  'base64'
);
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

let fixtureDirectory;

test.before(async () => {
  fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'prescription-storage-test-'));
  await fs.writeFile(path.join(fixtureDirectory, 'sample.jpg'), JPEG_BYTES);
  await fs.writeFile(path.join(fixtureDirectory, 'sample.png'), PNG_BYTES);
  await fs.writeFile(path.join(fixtureDirectory, 'sample.pdf'), PDF_BYTES);
});

test.after(async () => {
  if (fixtureDirectory) await fs.rm(fixtureDirectory, { recursive: true, force: true });
  if (originalRepository) require.cache[repositoryPath] = originalRepository;
  else delete require.cache[repositoryPath];
});

async function fixture(name, mimeType) {
  const buffer = await fs.readFile(path.join(fixtureDirectory, name));
  return { buffer, originalName: name, declaredMimeType: mimeType, size: buffer.length };
}

test('actual PDF, JPEG, and PNG files are stored under generated names and round-trip exactly', async () => {
  for (const [name, mimeType] of [['sample.jpg', 'image/jpeg'], ['sample.png', 'image/png'], ['sample.pdf', 'application/pdf']]) {
    const file = await fixture(name, mimeType);
    const metadata = storage.validateAndDescribe(file);
    assert.match(metadata.storedFilename, /^[0-9a-f-]+\.(jpg|png|pdf)$/i);
    assert.notEqual(metadata.storedFilename, name);
    assert.equal(path.isAbsolute(metadata.storagePath), false);
    assert.match(metadata.storagePath, /^prescriptions\//);

    await storage.saveFile(file.buffer, metadata);
    try {
      assert.deepEqual(await storage.readFile(metadata.storagePath), file.buffer);
    } finally {
      await storage.deleteFile(metadata.storagePath);
    }
  }
});

test('unsupported, empty, oversized, and mismatched files are rejected server-side', async () => {
  assert.throws(
    () => storage.validateAndDescribe({ buffer: Buffer.from('text'), originalName: 'note.txt', declaredMimeType: 'text/plain', size: 4 }),
    error => error.statusCode === 415
  );
  assert.throws(
    () => storage.validateAndDescribe({ buffer: Buffer.alloc(0), originalName: 'empty.png', declaredMimeType: 'image/png', size: 0 }),
    error => error.statusCode === 400
  );
  const oversized = Buffer.alloc(storage.MAX_FILE_BYTES + 1, 1);
  assert.throws(
    () => storage.validateAndDescribe({ buffer: oversized, originalName: 'large.jpg', declaredMimeType: 'image/jpeg', size: oversized.length }),
    error => error.statusCode === 413
  );
  assert.throws(
    () => storage.validateAndDescribe({ buffer: PNG_BYTES, originalName: 'fake.jpg', declaredMimeType: 'image/jpeg', size: PNG_BYTES.length }),
    error => error.statusCode === 415
  );
  assert.throws(
    () => storage.validateAndDescribe({ buffer: Buffer.from('not-a-pdf'), originalName: 'scan.pdf', declaredMimeType: 'application/pdf', size: 9 }),
    error => error.statusCode === 415
  );
});

test('storage references cannot traverse outside the managed prescription directory', () => {
  for (const unsafePath of ['../secret.jpg', 'prescriptions/../../secret.jpg', 'C:\\secret.jpg', '/secret.jpg', 'prescriptions/not-a-uuid.jpg']) {
    assert.throws(() => storage.resolveStoragePath(unsafePath), error => error.statusCode === 404);
  }
});

test('a database insert failure removes the newly written file', async () => {
  const file = await fixture('sample.jpg', 'image/jpeg');
  let storagePath;
  const trackingStorage = {
    ...storage,
    validateAndDescribe(value) {
      const metadata = storage.validateAndDescribe(value);
      storagePath = metadata.storagePath;
      return metadata;
    },
  };

  await assert.rejects(
    persistPrescriptionUpload(
      { customerId: 1, file, doctorName: '', notes: '' },
      { storage: trackingStorage, repository: { createUpload: async () => { throw new Error('simulated database failure'); } } }
    ),
    /simulated database failure/
  );
  await assert.rejects(fs.access(storage.resolveStoragePath(storagePath)), error => error.code === 'ENOENT');
});

test('a file-write failure never attempts a database insert', async () => {
  let inserts = 0;
  const metadata = {
    originalFilename: 'sample.jpg',
    storedFilename: '00000000-0000-4000-8000-000000000000.jpg',
    storagePath: 'prescriptions/00000000-0000-4000-8000-000000000000.jpg',
    mimeType: 'image/jpeg',
    fileSize: JPEG_BYTES.length,
  };
  await assert.rejects(
    persistPrescriptionUpload(
      { customerId: 1, file: await fixture('sample.jpg', 'image/jpeg'), doctorName: '', notes: '' },
      {
        storage: {
          validateAndDescribe: () => metadata,
          saveFile: async () => { throw new Error('simulated file failure'); },
          deleteFile: async () => {},
        },
        repository: { createUpload: async () => { inserts += 1; } },
      }
    ),
    /simulated file failure/
  );
  assert.equal(inserts, 0);
});
