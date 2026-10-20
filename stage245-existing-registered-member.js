const fs=require('fs');
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('registration_paid_existing')){
  schema += "\nALTER TABLE member_balances ADD COLUMN IF NOT EXISTS registration_paid_existing BOOLEAN NOT NULL DEFAULT FALSE;\n";
  fs.writeFileSync(schemaPath,schema);
}
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.post('/existing-registration-v245'")){
  const anchor='\nmodule.exports = router;';
  if(!admin.includes(anchor))throw Error('Stage 245: admin router export marker missing.');
  const route=[
"router.post('/existing-registration-v245',requireAdminPermission('manage_accounts'),async(req,res)=>{",
" const username=String(req.body&&req.body.username||'').trim().toUpperCase();",
" if(!username)return res.status(400).json({error:'Member username is required.'});",
" const client=await pool.connect();try{await client.query('BEGIN');",
" const found=await client.query(\"SELECT id,username,role FROM accounts WHERE username=$1 AND role IN ('regular','flexible') FOR UPDATE\",[username]);",
" if(!found.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'New Regular or Flexible account not found.'});}",
" await client.query('UPDATE member_balances SET registration_paid_existing=TRUE WHERE account_id=$1',[found.rows[0].id]);",
" await client.query('COMMIT');res.set('Cache-Control','no-store');res.json({saved:true,username:found.rows[0].username});",
" }catch(error){await client.query('ROLLBACK').catch(()=>{});console.error('Existing registration status save failed:',error.message);res.status(500).json({error:'Could not save existing registration status.'});}finally{client.release();}",
"});"
].join('\n');
  admin=admin.replace(anchor,'\n'+route+anchor);fs.writeFileSync('server/routes/admin.js',admin);
}
/* Include the persisted flag in Admin CHECK's explicit query and response. */
admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace('b.application_form FROM accounts a LEFT JOIN member_balances b','b.application_form,b.registration_paid_existing FROM accounts a LEFT JOIN member_balances b');
admin=admin.replace('balances:balanceView(row)','balances:{...balanceView(row),registrationPaidExisting:row.registration_paid_existing===true}');
fs.writeFileSync('server/routes/admin.js',admin);

let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(/b\.application_form(?!,b\.registration_paid_existing)/g,'b.application_form,b.registration_paid_existing');
account=account.replace(/balanceView\(([A-Za-z_$][\w$]*)\)/g,'{...balanceView($1),registrationPaidExisting:$1.registration_paid_existing===true}');
fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');
const createMarker="const selectedRole = newRole.value; const createdUsername = String(data.account.username||'');";
if(!app.includes(createMarker))throw Error('Stage 245: Create New Member success marker missing.');
if(!app.includes('tmcsExistingRegistrationCaptureV245')){
  const formMarker="createAccountForm.addEventListener('submit',";
  if(!app.includes(formMarker))throw Error('Stage 245: Create New Member form listener missing.');
  app=app.replace(formMarker,"let tmcsExistingRegistrationCaptureV245=false;\ncreateAccountForm.addEventListener('submit',()=>{tmcsExistingRegistrationCaptureV245=Boolean(document.getElementById('existingRegisteredMemberV245')?.checked);},true);\n"+formMarker);
  const save=" if(tmcsExistingRegistrationCaptureV245){try{await api('/api/admin/existing-registration-v245',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:createdUsername})});}catch(existingRegError){createAccountError.textContent='Account created, but existing registration status was NOT saved: '+(existingRegError?.message||'Contact administrator.');tmcsExistingRegistrationCaptureV245=false;return;}} tmcsExistingRegistrationCaptureV245=false;";
  app=app.replace(createMarker,createMarker+save);
}
const regTilePattern=/\[\s*['"]REGISTRATION['"]\s*,\s*(?:naira\(b\.registration\)|b\.registration)\s*\]/;
const regTileNew="['REGISTRATION', b.registrationPaidExisting ? 'COMPLETED ✓' : naira(b.registration)]";
if(regTilePattern.test(app))app=app.replace(regTilePattern,regTileNew);
else if(!app.includes(regTileNew))throw Error('Stage 245: REGISTRATION tile render marker missing.');
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=264'");
fs.writeFileSync('www/app.js',app);
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="existingRegisteredMemberV245"')){
  const input=/<input\b(?=[^>]*\bid=["']newUsername["'])[^>]*>/;
  if(!input.test(html))throw Error('Stage 245: Create New Member username field markup missing.');
  const checkbox='<label class="existing-registered-member-v245" style="display:flex;align-items:center;gap:10px;margin:10px 0;font-weight:700"><input id="existingRegisteredMemberV245" name="existingRegisteredMember" type="checkbox" style="width:auto;min-width:18px;min-height:18px"> Existing Registered Member — registration already paid</label>';
  html=html.replace(input,m=>m+'\n'+checkbox);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=264').replace(/styles\.css\?v=\d+/g,'styles.css?v=264');
fs.writeFileSync('www/index.html',html);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v264';").replace(/app\.js\?v=\d+/g,'app.js?v=264').replace(/styles\.css\?v=\d+/g,'styles.css?v=264');
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 245: existing registration checkbox and persisted status wired.');
