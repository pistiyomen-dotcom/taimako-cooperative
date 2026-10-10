'use strict';
// A financial handler must call this within its existing database transaction.
// This module never changes member account ownership or reassigns transactions.
const {resolve,recordAction}=require('./session-service');
async function withAssistedFinancialAction({pool,adminId,token,action,execute}) {
  if(!pool||typeof execute!=='function') throw new Error('Database and financial action required');
  if(!Number.isSafeInteger(Number(adminId))||Number(adminId)<=0) throw new Error('Administrator identity required');
  const session=await resolve(pool,token,Number(adminId));
  const client=await pool.connect();
  let begun=false;
  try{
    await client.query('BEGIN');begun=true;
    // Lock and revalidate session inside this same transaction.
    const lock=await client.query(
      `SELECT s.id FROM member_assistance_sessions s
       JOIN accounts a ON a.id=s.operator_account_id
       JOIN accounts m ON m.id=s.member_account_id
       JOIN admin_permissions p ON p.account_id=a.id
       WHERE s.id=$1 AND s.operator_account_id=$2 AND s.member_account_id=$3
         AND s.ended_at IS NULL AND s.expires_at>NOW()
         AND a.role='admin' AND a.is_active=true AND p.manage_accounts=true
         AND m.role IN ('regular','flexible') AND m.is_active=true FOR UPDATE OF s`,
      [session.id,session.operator_account_id,session.member_account_id]);
    if(!lock.rowCount) throw new Error('Assistance session is no longer authorized');
    const result=await execute({client,memberAccountId:session.member_account_id,
      memberRole:session.member_role,operatorAccountId:session.operator_account_id,
      assistanceSessionId:session.id});
    if(!result||!result.audit||!result.audit.actionCompleted)
      throw new Error('Financial handler must return completed action audit details');
    await recordAction(client,session,action,result.audit.details||{},result.audit.transactionId||null);
    await client.query('COMMIT');
    begun=false;
    return result.value;
  }catch(err){
    if(begun)await client.query('ROLLBACK');
    throw err;
  }finally{client.release();}
}
module.exports={withAssistedFinancialAction};
