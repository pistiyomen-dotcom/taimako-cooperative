'use strict';
// Isolated assisted-access service. Not wired to production routes until
// every financial mutation supports atomic actor attribution.
const crypto = require('node:crypto');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

async function start(pool, operatorId, memberUsername) {
  const username = String(memberUsername || '').trim().toUpperCase();
  if (!/^(?:[0-9]{1,5}|F[0-9]{3})$/.test(username)) throw new Error('Invalid member username');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const operator = (await client.query(
      "SELECT id,username FROM accounts WHERE id=$1 AND role='admin' AND is_active=true",
      [operatorId])).rows[0];
    if (!operator) throw new Error('Administrator access required');
    const permission = (await client.query(
      'SELECT manage_accounts FROM admin_permissions WHERE account_id=$1',
      [operatorId])).rows[0];
    if (!permission || permission.manage_accounts !== true) throw new Error('Member assistance permission required');
    const member = (await client.query(
      "SELECT id,username,full_name,role FROM accounts WHERE username=$1 AND is_active=true AND role IN ('regular','flexible')",
      [username])).rows[0];
    if (!member) throw new Error('Active member not found');
    const token = crypto.randomBytes(32).toString('hex');
    const result = await client.query(
      "INSERT INTO member_assistance_sessions(operator_account_id,member_account_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '15 minutes') RETURNING id,expires_at",
      [operator.id,member.id,sha(token)]);
    await client.query('COMMIT');
    return {token,sessionId:result.rows[0].id,expiresAt:result.rows[0].expires_at,
      member:{id:member.id,username:member.username,name:member.full_name,role:member.role},
      adminUsername:operator.username};
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// The caller must authenticate the admin JWT before invoking resolve().
async function resolve(pool, token, operatorId) {
  if (!/^[a-f0-9]{64}$/.test(String(token||''))) throw new Error('Invalid assistance session');
  const result = await pool.query(
    `SELECT s.id,s.operator_account_id,s.member_account_id,m.username AS member_username,m.role AS member_role,
      a.username AS operator_username
      FROM member_assistance_sessions s
      JOIN accounts m ON m.id=s.member_account_id
      JOIN accounts a ON a.id=s.operator_account_id
      JOIN admin_permissions p ON p.account_id=a.id
      WHERE s.token_hash=$1 AND s.operator_account_id=$2 AND s.ended_at IS NULL
      AND s.expires_at>NOW() AND a.is_active=true AND a.role='admin'
      AND m.is_active=true AND m.role IN ('regular','flexible') AND p.manage_accounts=true`,
    [sha(token),operatorId]);
  if (!result.rowCount) throw new Error('Assistance session expired or unauthorized');
  return result.rows[0];
}
async function end(pool, token, operatorId) {
  if (!/^[a-f0-9]{64}$/.test(String(token||''))) return false;
  const r = await pool.query(
    'UPDATE member_assistance_sessions SET ended_at=NOW() WHERE token_hash=$1 AND operator_account_id=$2 AND ended_at IS NULL RETURNING id',
    [sha(token),operatorId]);
  return !!r.rowCount;
}

// Call inside the SAME db transaction as the financial write, before COMMIT.
// Do not backfill, infer ownership by timestamp, or mutate historic records.
async function recordAction(client, session, action, details, transactionId=null) {
  if (!session || !session.id || !session.operator_account_id || !session.member_account_id)
    throw new Error('Verified assistance session required');
  if (!client || typeof client.query !== 'function') throw new Error('Database transaction required');
  const code = String(action||'').trim();
  if (!/^[A-Z][A-Z0-9_]{1,79}$/.test(code)) throw new Error('Invalid audit action');
  await client.query(
    'INSERT INTO member_assistance_actions(session_id,operator_account_id,member_account_id,action_code,transaction_id,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
    [session.id,session.operator_account_id,session.member_account_id,
      code,transactionId,JSON.stringify(details||{})]);
}
module.exports = {start,resolve,end,recordAction};
