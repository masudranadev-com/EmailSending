const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
let contents = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, 'utf8')
  : fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const secretLine = /^AUTH_SECRET\s*=([^\r\n]*)/m;
const match = contents.match(secretLine);
const current = match?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');

if (!current || current === 'change_me_auth_secret') {
  const line = `AUTH_SECRET=${randomBytes(32).toString('hex')}`;
  contents = match
    ? contents.replace(secretLine, line)
    : `${contents.trimEnd()}\n${line}\n`;
  fs.writeFileSync(envPath, contents, { mode: 0o600 });
  console.log('Configured AUTH_SECRET in .env with a private random value.');
} else {
  console.log('Preserved the existing AUTH_SECRET in .env.');
}

console.log('For Portainer, import this .env under the stack Environment variables before deploying.');
