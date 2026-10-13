// Stage 233: integrate one-time referral data and read-only member API.
const fs=require('fs');
const sql=fs.readFileSync('server/db/referral-bonus-v233.sql','utf8');
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('tmcs_referral_first_saving_v233')){
  if(!schema.includes('\nCOMMIT;')) throw Error('Referral schema insertion point not found.');
  schema=schema.replace('\nCOMMIT;','\n'+sql+'\nCOMMIT;');
  fs.writeFileSync('server/db/schema.sql',schema);
}
let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes("router.get('/referral-bonus'")){
  const anchor="const express = require('express');";
  if(!account.includes(anchor))throw Error('Referral account API anchor not found.');
  const route = [
    "router.get('/referral-bonus', requireAuth, async(req,res)=>{",
    "  try{",
    "    const result=await pool.query(\"SELECT COALESCE(SUM(amount),0)::numeric(14,2) AS balance, COUNT(*)::int AS referred_members FROM referral_bonus_awards WHERE referrer_account_id=$1\",[req.auth.sub]);",
    "    res.set('Cache-Control','no-store');",
    "    res.json({balance:Number(result.rows[0]?.balance||0),referredMembers:Number(result.rows[0]?.referred_members||0)});",
    "  }catch(e){res.status(500).json({error:'Unable to read referral bonus.'});}",
    "});"
  ].join('\n');
  account=account.replace(anchor,anchor+'\n'+route);
  fs.writeFileSync('server/routes/account.js',account);
}
console.log('Stage 233 referral migration and authenticated bonus balance route installed.');
