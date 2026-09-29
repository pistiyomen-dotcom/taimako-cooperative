const fs=require('fs');

// Stage 35: persistent failed-login protection.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('failed_login_attempts')){
  const alter=`

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
`;
  schema=schema.replace('\nCOMMIT;',alter+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

const authPath='server/routes/auth.js';
let auth=fs.readFileSync(authPath,'utf8');

if(!auth.includes('MAX_LOGIN_ATTEMPTS')){
  auth=auth.replace("const router = express.Router();","const router = express.Router();\nconst MAX_LOGIN_ATTEMPTS = 5;\nconst LOGIN_LOCK_MINUTES = 15;");
}

if(!auth.includes('failed_login_attempts, locked_until')){
  auth=auth.replace(
    /SELECT id, username, full_name, role, password_hash, must_change_password\s+FROM accounts\s+WHERE username=\$1 AND is_active=TRUE/i,
    "SELECT id, username, full_name, role, password_hash, must_change_password, failed_login_attempts, locked_until FROM accounts WHERE username=$1 AND is_active=TRUE"
  );
}

// Inject lockout checks immediately after account lookup.
if(!auth.includes('Account temporarily locked')){
  const marker="  const account = result.rows[0];";
  const inject=`
  const account = result.rows[0];
  if (account?.locked_until && new Date(account.locked_until) > new Date()) {
    const retryMinutes = Math.max(1, Math.ceil((new Date(account.locked_until) - new Date()) / 60000));
    return res.status(429).json({ error: 'Account temporarily locked after repeated failed login attempts. Try again in about ' + retryMinutes + ' minute(s).' });
  }
`;
  if(!auth.includes(marker)){ console.error('Stage 35 account lookup marker not found'); process.exit(1); }
  auth=auth.replace(marker,inject);
}

// Replace invalid-credential return with persistent failed-attempt tracking.
if(!auth.includes('failed_login_attempts=failed_login_attempts+1')){
  const re=/if \(!account \|\| !\(await bcrypt\.compare\([^\n]+\)\)\)\s*\{?[\s\S]*?return res\.status\(401\)\.json\(\{ error: 'Invalid username or password\/PIN\.' \}\);\s*\}?/m;
  if(!re.test(auth)){ console.error('Stage 35 invalid-login block not found'); process.exit(1); }
  const replacement=`
  const passwordOk = account ? await bcrypt.compare(password, account.password_hash) : false;
  if (!account || !passwordOk) {
    if (account) {
      const nextAttempts = Number(account.failed_login_attempts || 0) + 1;
      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        await pool.query("UPDATE accounts SET failed_login_attempts=0, locked_until=NOW()+($1::text||' minutes')::interval WHERE id=$2", [LOGIN_LOCK_MINUTES, account.id]);
        return res.status(429).json({ error: 'Too many failed login attempts. This account is locked for 15 minutes.' });
      }
      await pool.query('UPDATE accounts SET failed_login_attempts=failed_login_attempts+1 WHERE id=$1', [account.id]);
    }
    return res.status(401).json({ error: 'Invalid username or password/PIN.' });
  }
`;
  auth=auth.replace(re,replacement);
}

// Reset failed-attempt state on successful login before issuing token.
if(!auth.includes('SET failed_login_attempts=0, locked_until=NULL')){
  const marker="  const token = jwt.sign(";
  const inject="  await pool.query('UPDATE accounts SET failed_login_attempts=0, locked_until=NULL WHERE id=$1', [account.id]);\n\n  const token = jwt.sign(";
  if(!auth.includes(marker)){ console.error('Stage 35 token marker not found'); process.exit(1); }
  auth=auth.replace(marker,inject);
}

fs.writeFileSync(authPath,auth);

console.log('TAIMAKO Stage 35 failed-login protection applied.');
