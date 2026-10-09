'use strict';
// Mount under /api/admin/member-assistance only after its database migration.
// Does not impersonate a member JWT or expose member credentials.
const express = require('express');
const sessionService = require('./session-service');

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
  router.post('/end', async (req,res)=>{
    if (!adminId(req)) return res.status(403).json({error:'Administrator login required'});
    const ended=await sessionService.end(pool,req.headers['x-tmcs-assistance-token'],adminId(req));
    res.json({ended});
  });
  return router;
}
module.exports={createAssistanceRouter};
