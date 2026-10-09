'use strict';
// Mount under /api/admin/member-assistance only after its database migration.
// Does not impersonate a member JWT or expose member credentials.
const express = require('express');
const sessionService = require('./session-service');
const {assistanceContext} = require('./context-middleware');

function createAssistanceRouter({pool, requireAuth}) {
  if (!pool || typeof requireAuth !== 'function') throw new Error('Pool and requireAuth are required');
  const router = express.Router();
  router.use(requireAuth);
  function adminId(req) {
    return String(req.auth?.role||'').toLowerCase()==='admin' ? Number(req.auth?.sub||0) : 0;
  }
  router.post('/start', async (req,res)=>{
    if (!adminId(req)) return res.status(403).json({error:'Administrator login required'});
    try {
      if (req.body?.memberConfirmed !== true) return res.status(400).json({error:'Confirm the member instruction before opening an assisted session'});
      const result = await sessionService.start(pool,adminId(req),req.body?.username);
      res.status(201).json(result);
    } catch(err) {
      res.status(/permission|access|unauthorized/i.test(err.message)?403:400).json({error:err.message});
    }
  });
  router.get('/session', async (req,res)=>{
    if (!adminId(req)) return res.status(403).json({error:'Administrator login required'});
    try {
      const session = await sessionService.resolve(pool,req.headers['x-tmcs-assistance-token'],adminId(req));
      res.json({session:{id:session.id,memberUsername:session.member_username,
        memberRole:session.member_role,operatorUsername:session.operator_username}});
    } catch(_) {res.status(403).json({error:'Assistance session expired or unauthorized'});}
  });
  // First real member dashboard data endpoint: READ ONLY until every member
  // financial operation has atomic operator-attribution integration.
  router.get('/dashboard', assistanceContext({pool}), async (req,res)=>{
    try {
      const target=req.assistance;
      const memberResult=await pool.query(
        "SELECT id,username,full_name,role,is_active FROM accounts WHERE id=$1",
        [target.memberAccountId]);
      const member=memberResult.rows[0];
      if (!member || !member.is_active) return res.status(404).json({error:'Active member not found'});
      const balanceResult=await pool.query(
        "SELECT regular,target,constant,welfare,flexible,loan_principal,loan_interest,loan_due_date FROM member_balances WHERE account_id=$1",
        [target.memberAccountId]);
      res.set('Cache-Control','no-store');
      res.json({member,balance:balanceResult.rows[0]||{},assistedBy:target.operatorAccountId,readOnly:true});
    }catch(error){
      console.error('Assisted dashboard failed',error);
      res.status(500).json({error:'Unable to load member dashboard'});
    }
  });
  router.post('/end', async (req,res)=>{
    if (!adminId(req)) return res.status(403).json({error:'Administrator login required'});
    const ended=await sessionService.end(pool,req.headers['x-tmcs-assistance-token'],adminId(req));
    res.json({ended});
  });
  return router;
}
module.exports={createAssistanceRouter};
