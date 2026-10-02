// Run interactively after the auth migration. Password input is not echoed and
// never appears in process arguments, the repository or a SQL seed file.
const bcrypt = require('bcryptjs');
const users = require('../src/repositories/userRepository');
const { close } = require('../src/config/database');

const allowed = new Set(['PRESCRIPTION_STAFF', 'SUPPLIER', 'INVENTORY_STAFF', 'SALES_STAFF']);
const [role, rawUsername, rawEmail] = process.argv.slice(2);
if (!allowed.has(role) || !rawUsername || !rawEmail || !process.stdin.isTTY) {
  console.error('Usage (interactive terminal): node scripts/createStaffAccount.js ROLE username email');
  process.exit(1);
}

function hiddenPassword() {
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write('Private password (at least 12 characters): ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function done(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    }
    function onData(chunk) {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') { done(); return; }
        if (char === '\u0003') { done(new Error('Cancelled')); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    }
    process.stdin.on('data', onData);
  });
}

async function main() {
  const username = rawUsername.trim().toLowerCase();
  const email = rawEmail.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,100}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid username or email');
  if (await users.findByIdentifier(username) || await users.findByIdentifier(email)) throw new Error('Username or email already exists');
  const password = await hiddenPassword();
  if (password.length < 12) throw new Error('Password must be at least 12 characters');
  const user = await users.createStaffAccount({ role, username, email }, await bcrypt.hash(password, 12));
  console.log(`Created ${user.role} account: ${user.username} (id ${user.id})`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => close());
