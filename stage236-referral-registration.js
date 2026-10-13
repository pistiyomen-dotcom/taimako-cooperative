const fs=require('fs');
let admin=fs.readFileSync('server/routes/admin.js','utf8');
const anchor="router.get('/last-created-usernames'";
if(!admin.includes(anchor))throw Error('Admin route anchor not found');
if(!admin.includes("router.post('/referral-link-v236'")){
const route=[
"router.post('/referral-link-v236',requireAdminPermission('manage_accounts'),async(req,res)=>{",
" const referred=String(req.body?.referredUsername||'').trim().toUpperCase();",
" const referrer=String(req.body?.referrerUsername||'').trim().toUpperCase();",
" if(!/^\\d{1,5}$/.test(referred)||!/^\\d{1,5}$/.test(referrer)||referred===referrer)return res.status(400).json({error:'Enter two distinct valid Regular usernames.'});",
" const client=await pool.connect();try{await client.query('BEGIN');",
" const found=await client.query('SELECT id,username,role,is_active,created_at FROM accounts WHERE username IN ($1,$2) ORDER BY id FOR UPDATE',[referred,referrer]);",
" const child=found.rows.find(x=>x.username===referred),sponsor=found.rows.find(x=>x.username===referrer);",
" if(!child||!sponsor||child.role!=='regular'||sponsor.role!=='regular'||!sponsor.is_active){await client.query('ROLLBACK');return res.status(400).json({error:'Active Regular referrer and new Regular member required.'});}",
" if(Date.now()-new Date(child.created_at).getTime()>15*60000){await client.query('ROLLBACK');return res.status(409).json({error:'Referral must be recorded when creating the account.'});}",
" const prior=await client.query(\"SELECT 1 FROM transactions WHERE account_id=$1 AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') AND amount>0 AND status IN ('approved','completed') LIMIT 1\",[child.id]);",
" if(prior.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Referral cannot be assigned after the first savings deposit.'});}",
" const link=await client.query('INSERT INTO member_referrals(referred_account_id,referrer_account_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING referred_account_id',[child.id,sponsor.id]);",
" if(!link.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Referral already linked.'});}",
" await client.query('COMMIT');res.json({saved:true});",
" }catch(e){await client.query('ROLLBACK').catch(()=>{});res.status(500).json({error:'Could not save referral.'});}finally{client.release();}",
"});"
].join('\n');
admin=admin.replace(anchor,route+'\n'+anchor);fs.writeFileSync('server/routes/admin.js',admin);
}
let app=fs.readFileSync('www/app.js','utf8');
const marker="const selectedRole = newRole.value; const createdUsername = String(data.account.username||'');";
if(!app.includes(marker))throw Error('Create Account success marker missing');
if(!app.includes('tmcsReferralCaptureV236')){
const inputAnchor="document.getElementById('newUsername').addEventListener('input',(e)=>{";
if(!app.includes(inputAnchor))throw Error('Create Account input listener missing');
const capture="let tmcsReferralCaptureV236='';\ncreateAccountForm.addEventListener('submit',()=>{tmcsReferralCaptureV236=String(document.getElementById('newReferredByV235')?.value||'').trim();},true);\n";
app=app.replace(inputAnchor,capture+inputAnchor);
const save=" if(selectedRole==='regular'&&tmcsReferralCaptureV236){try{await api('/api/admin/referral-link-v236',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({referredUsername:createdUsername,referrerUsername:tmcsReferralCaptureV236})});}catch(refError){createAccountError.textContent='Account created but referral NOT saved: '+(refError?.message||'Contact administrator.');}}tmcsReferralCaptureV236='';";
app=app.replace(marker,marker+save);fs.writeFileSync('www/app.js',app);
}
console.log('Referral create account validation and saving wired.');
