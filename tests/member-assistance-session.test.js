'use strict';
const assert=require('node:assert/strict');
const {start,resolve,end,recordAction}=require('../assisted-access/session-service');
async function main(){
 const calls=[];
 const client={
  query:async(sql,args=[])=>{
   calls.push({sql,args});
   if(sql.startsWith('SELECT id,username FROM accounts'))return {rows:[{id:7,username:'ADMIN7'}]};
   if(sql.startsWith('SELECT manage_accounts'))return {rows:[{manage_accounts:true}]};
   if(sql.startsWith('SELECT id,username,full_name,role FROM accounts'))return {rows:[{id:20,username:'F123',full_name:'Example Member',role:'flexible'}]};
   if(sql.startsWith('INSERT INTO member_assistance_sessions'))return {rows:[{id:42,expires_at:new Date()}]};
   return {rows:[],rowCount:1};
  },release(){}
 };
 const pool={connect:async()=>client,query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('FROM member_assistance_sessions s'))return {rowCount:1,rows:[{id:42,operator_account_id:7,member_account_id:20,operator_username:'ADMIN7',member_username:'F123',member_role:'flexible'}]};
  return {rowCount:1,rows:[{id:42}]};
 }};
 const created=await start(pool,7,'F123');
 assert.match(created.token,/^[a-f0-9]{64}$/);
 assert.equal(created.member.username,'F123');
 const member=await resolve(pool,created.token,7);
 assert.equal(member.member_account_id,20);
 await recordAction(client,member,'WITHDRAWAL_REQUEST',{amount:1000},99);
 assert.ok(calls.some(c=>c.sql.startsWith('INSERT INTO member_assistance_actions')&&c.args[1]===7&&c.args[2]===20));
 await assert.rejects(()=>recordAction(client,{id:42},'WITHDRAWAL_REQUEST',{}),/Verified assistance session required/);
 await assert.rejects(()=>recordAction(client,member,'bad action',{}),/Invalid audit action/);
 assert.equal(await end(pool,created.token,7),true);
 await assert.rejects(()=>start(pool,7,'../../admin'),/Invalid member username/);
 await assert.rejects(()=>resolve(pool,'bad-token',7),/Invalid assistance session/);
 console.log('PASS: assisted session service happy-path and input guard tests');
}
main().catch(e=>{console.error(e);process.exitCode=1});
