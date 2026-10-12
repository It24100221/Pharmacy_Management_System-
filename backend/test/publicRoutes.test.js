const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

process.env.JWT_SECRET ||= 'qa-public-route-secret-at-least-32-characters'

const databasePath = require.resolve('../src/config/database')
const originalDatabaseModule = require.cache[databasePath]
const databaseStub = new Module(databasePath)
databaseStub.filename = databasePath
databaseStub.loaded = true
databaseStub.exports = {
  pool: {
    async execute(query) {
      if (query.includes('SELECT 1 AS ready')) return [[{ ready: 1 }]]
      throw new Error(`Unexpected database query: ${query}`)
    },
  },
}
require.cache[databasePath] = databaseStub

const appPath = require.resolve('../src/app')
delete require.cache[appPath]
const app = require(appPath)

let server
let baseUrl

test.before(async () => {
  server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  delete require.cache[appPath]
  if (originalDatabaseModule) require.cache[databasePath] = originalDatabaseModule
  else delete require.cache[databasePath]
})

test('health is public and returns only safe readiness information', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(Object.keys(body).sort(), ['database', 'message', 'success', 'timestamp'])
  assert.equal(body.database, 'connected')
})

test('customer registration reaches public validation without a token', async () => {
  const response = await fetch(`${baseUrl}/api/customers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const body = await response.json()
  assert.equal(response.status, 400)
  assert.notEqual(body.message, 'Authentication required')
})

test('staff-only APIs still reject requests without a token', async () => {
  const response = await fetch(`${baseUrl}/api/medicines`)
  assert.equal(response.status, 401)
})
