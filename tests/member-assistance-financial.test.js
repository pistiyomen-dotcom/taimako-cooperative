'use strict';
const assert=require('node:assert/strict');
const {withAssistedFinancialAction}=require('../assisted-access/financial-transaction');
async function main(){
 const calls=[];
 let fail=false;
 const client={query:async(sql,args)=>{
   calls.push(sql);
   if(sql.startsWith('SELECT s.id FROM member_assistance_sessions'))return {rowCount:1,rows:[{id:12}]};
   return {rowCount:1,rows:[]};
 },release(){}};
 const pool={connect:async()=>client,query:async(sql)=>{
   if(sql.includes('FROM member_assistance_sessions s'))return {rowCount:1,rows:[{
     id:12,operator_account_id:7,member_account_id:21,
     operator_username:'ADMIN7',member_username:'12345',member_role:'regular'
   }]};
   return {rows:[]};
 }};
 const ok=await withAssistedFinancialAction({pool,adminId:7,token:'a'.repeat(64),action:'SAVINGS_REQUEST',
 execute:async({client,memberAccountId,operatorAccountId})=>{
   assert.equal(memberAccountId,21);assert.equal(operatorAccountId,7);
   await client.query('INSERT INTO example_financial_table ...');
   return {value:{ok:true},audit:{actionCompleted:true,transactionId:32,details:{amount:5000}}};
 }});
 assert.equal(ok.ok,true);
 assert.ok(calls.includes('COMMIT'));
 assert.ok(calls.some(x=>x.startsWith('INSERT INTO member_assistance_actions')));
 calls.length=0;
 await assert.rejects(()=>withAssistedFinancialAction({pool,adminId:7,token:'a'.repeat(64),action:'SAVINGS_REQUEST',
   execute:async()=>{throw Error('simulated failure');}}),/simulated failure/);
 assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));
 console.log('PASS: atomic assisted financial transaction commit and rollback');
}
main().catch(e=>{console.error(e);process.exitCode=1});
