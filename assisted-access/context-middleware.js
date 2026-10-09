'use strict';
// Authenticate the ADMIN first. This middleware only authorizes the selected
// member context; it never substitutes a member JWT or trusts a username header.
const {resolve}=require('./session-service');
function assistanceContext({pool,allowedMethods=['GET','HEAD']}) {
 if(!pool) throw new Error('Database pool required');
 return async (req,res,next)=>{
  try {
   if(req.auth?.role!=='admin'||!Number(req.auth?.sub)) return res.status(403).json({error:'Administrator authentication required'});
   if(!allowedMethods.includes(String(req.method).toUpperCase())) return res.status(403).json({error:'Assisted financial actions are not enabled'});
   const session=await resolve(pool,req.headers['x-tmcs-assistance-token'],Number(req.auth.sub));
   req.assistance={sessionId:session.id,operatorAccountId:session.operator_account_id,memberAccountId:session.member_account_id,memberUsername:session.member_username,memberRole:session.member_role};
   return next();
  }catch(_){return res.status(403).json({error:'Assistance session expired or unauthorized'});}
 };
}
module.exports={assistanceContext};
