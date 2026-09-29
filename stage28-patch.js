const fs=require('fs');

// 1) Persistent Target monthly reward records.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS savings_target_rewards')){
  const table=`

CREATE TABLE IF NOT EXISTS savings_target_rewards (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  required_amount NUMERIC(14,2) NOT NULL CHECK (required_amount >= 0),
  contributed_amount NUMERIC(14,2) NOT NULL CHECK (contributed_amount >= 0),
  reward_rate NUMERIC(6,2) NOT NULL DEFAULT 1.00 CHECK (reward_rate >= 0),
  reward_amount NUMERIC(14,2) NOT NULL CHECK (reward_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'credited' CHECK (status IN ('credited','reversed')),
  credited_by_account_id BIGINT REFERENCES accounts(id),
  credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_reference VARCHAR(40) UNIQUE,
  UNIQUE(account_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_savings_target_rewards_account_month ON savings_target_rewards(account_id,period_month DESC);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

// 2) Extend month-end compliance close to also credit 1% Target reward when monthly target is fulfilled.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("targetRewardCreated")){
  const oldPush="      results.push({username:p.username,name:p.full_name,planType:p.plan_type,requiredAmount:required,contributedAmount:contributed,shortfallAmount:shortfall,chargeAmount:charge,compliant:shortfall===0,chargeCreated:created});";
  const newBlock=`
      let targetRewardCreated=false;
      let targetRewardAmount=0;
      if(p.plan_type==='TARGET' && shortfall===0 && required>0){
        targetRewardAmount=Number((required*0.01).toFixed(2));
        if(targetRewardAmount>0){
          const rewardRef='TGR-'+bounds.month.replace('-','')+'-'+p.account_id;
          const reward=await client.query("INSERT INTO savings_target_rewards(account_id,period_month,required_amount,contributed_amount,reward_rate,reward_amount,status,credited_by_account_id,transaction_reference) VALUES($1,$2,$3,$4,1,$5,'credited',$6,$7) ON CONFLICT(account_id,period_month) DO NOTHING RETURNING id",[p.account_id,bounds.start,required,contributed,targetRewardAmount,req.auth.sub,rewardRef]);
          targetRewardCreated=reward.rows.length>0;
          if(targetRewardCreated){
            await client.query('UPDATE member_balances SET target=target+$1, updated_at=NOW() WHERE account_id=$2',[targetRewardAmount,p.account_id]);
            await client.query("INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,$3,'target_reward','TARGET',$4,'completed',$5,NOW())",[rewardRef,p.account_id,req.auth.sub,targetRewardAmount,'1% reward for fulfilled monthly Target Savings contribution for '+bounds.month]);
          }
        }
      }
      results.push({username:p.username,name:p.full_name,planType:p.plan_type,requiredAmount:required,contributedAmount:contributed,shortfallAmount:shortfall,chargeAmount:charge,compliant:shortfall===0,chargeCreated:created,targetRewardCreated,targetRewardAmount});
`;
  if(!admin.includes(oldPush)){ console.error('Stage 28 month-close result target not found'); process.exit(1); }
  admin=admin.replace(oldPush,newBlock);

  const oldResponse="    res.json({month:bounds.month,assessed:results.length,newCharges:createdCount,totalNewCharge:Number(totalNewCharge.toFixed(2)),results});";
  const newResponse="    const rewards=results.filter(r=>r.targetRewardCreated); const totalTargetReward=rewards.reduce((sum,r)=>sum+Number(r.targetRewardAmount||0),0); res.json({month:bounds.month,assessed:results.length,newCharges:createdCount,totalNewCharge:Number(totalNewCharge.toFixed(2)),newTargetRewards:rewards.length,totalTargetReward:Number(totalTargetReward.toFixed(2)),results});";
  if(!admin.includes(oldResponse)){ console.error('Stage 28 month-close response target not found'); process.exit(1); }
  admin=admin.replace(oldResponse,newResponse);
}

if(!admin.includes("router.get('/target-rewards'")){
  const route=`

router.get('/target-rewards', async (req,res) => {
  const username=String(req.query.username||'').trim().toUpperCase();
  const base="SELECT r.id,a.username,a.full_name,r.period_month,r.required_amount,r.contributed_amount,r.reward_rate,r.reward_amount,r.status,r.credited_at,r.transaction_reference FROM savings_target_rewards r JOIN accounts a ON a.id=r.account_id ";
  const result=username
    ? await pool.query(base+'WHERE a.username=$1 ORDER BY r.period_month DESC LIMIT 120',[username])
    : await pool.query(base+'ORDER BY r.period_month DESC,a.username LIMIT 500');
  res.json({rewards:result.rows});
});
`;
  admin=admin.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// 3) Member can see own credited Target rewards.
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
if(!account.includes("router.get('/target-rewards'")){
  const route=`

router.get('/target-rewards', requireAuth, async (req,res) => {
  const result=await pool.query("SELECT period_month,required_amount,contributed_amount,reward_rate,reward_amount,status,credited_at,transaction_reference FROM savings_target_rewards WHERE account_id=$1 ORDER BY period_month DESC LIMIT 120",[req.auth.sub]);
  const total=result.rows.filter(r=>r.status==='credited').reduce((sum,r)=>sum+Number(r.reward_amount||0),0);
  res.json({totalReward:Number(total.toFixed(2)),rewards:result.rows});
});
`;
  account=account.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(accountPath,account);

// 4) UI: show reward in month-end results and member Savings Plans.
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes('newTargetRewards')){
  app=app.replace(
"    success.textContent=data.month+': '+data.newCharges+' new shortfall charge(s) posted • '+naira(data.totalNewCharge)+' total new charges.';",
"    success.textContent=data.month+': '+data.newCharges+' new shortfall charge(s) posted • '+naira(data.totalNewCharge)+' charges • '+data.newTargetRewards+' Target reward(s) credited • '+naira(data.totalTargetReward)+' rewards.';"
  );
  app=app.replace(
"<small>'+(r.chargeCreated?'Charge posted':'No new charge posted')+'</small></div>'",
"<small>'+(r.chargeCreated?'Charge posted':'No new charge posted')+(r.targetRewardCreated?' • Target reward '+naira(r.targetRewardAmount)+' credited':'')+'</small></div>'"
  );
}

if(!app.includes("const targetRewards=await api('/api/account/target-rewards')")){
  app=app.replace(
"    const postedCharges=await api('/api/account/savings-compliance-charges');",
"    const postedCharges=await api('/api/account/savings-compliance-charges');\n    const targetRewards=await api('/api/account/target-rewards');"
  );
  app=app.replace(
"    const postedSummary='<p class=\"helper\"><strong>Outstanding month-end compliance charges:</strong> '+naira(postedCharges.outstandingTotal||0)+'</p>';",
"    const postedSummary='<p class=\"helper\"><strong>Outstanding month-end compliance charges:</strong> '+naira(postedCharges.outstandingTotal||0)+' • <strong>Total Target rewards credited:</strong> '+naira(targetRewards.totalReward||0)+'</p>';"
  );
}
fs.writeFileSync(appPath,app);

// 5) Cache bump.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=27/g,'app.js?v=28').replace(/styles\\.css\\?v=27/g,'styles.css?v=28');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v27/g,'taimako-v28');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=27/g,'sw.js?v=28');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 28 Target monthly reward applied.');
