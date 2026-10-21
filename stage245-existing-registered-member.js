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
" const saved=await client.query('UPDATE member_balances SET registration_paid_existing=TRUE WHERE account_id=$1',[found.rows[0].id]);",
" if(saved.rowCount!==1){await client.query('ROLLBACK');return res.status(409).json({error:'Account exists but its member-balance record was not found; registration status was not saved.'});}",
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

let accountRoute=fs.readFileSync('server/routes/account.js','utf8');
if(!accountRoute.includes("router.get('/registration-status-v245'")){
 const routeText=[
 "router.get('/registration-status-v245',async(req,res)=>{",
 " try{const r=await pool.query('SELECT registration_paid_existing FROM member_balances WHERE account_id=$1',[req.auth.sub]);",
 " res.set('Cache-Control','no-store');res.json({registrationPaidExisting:r.rows[0]?.registration_paid_existing===true});",
 " }catch(error){console.error('Registration status read failed:',error.message);res.status(500).json({error:'Could not read registration status.'});}",
 "});"
 ].join('\n');
 const marker='module.exports = router;';
 const at=accountRoute.lastIndexOf(marker);
 if(at<0)throw Error('Stage 245: account router export marker missing for status endpoint.');
 accountRoute=accountRoute.slice(0,at)+routeText+'\n\n'+accountRoute.slice(at);
 fs.writeFileSync('server/routes/account.js',accountRoute);
}

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
/* Read the durable flag directly, then update the visible registration tile. */
if(!app.includes('loadExistingRegistrationStatusV245')){
 app += String.raw`
let existingRegistrationStatusRequestV245=false;
function applyExistingRegistrationStatusV245(){
 if(!(state.balances&&state.balances.registrationPaidExisting===true))return;
 const root=document.getElementById('dashboardContent')||document.body;
 const isAmount=text=>/^(?:(?:₦|NGN)\s*)?\d[\d,]*(?:\.\d{1,2})?$/.test(String(text||'').trim());
 const labels=[...root.querySelectorAll('*')].filter(el=>el.children.length===0&&(el.textContent||'').trim().toUpperCase()==='REGISTRATION');
 for(const label of labels){
  let card=label.parentElement;
  for(let depth=0;depth<8&&card;depth++,card=card.parentElement){
   const amount=[...card.querySelectorAll('*')].find(el=>el.children.length===0&&el!==label&&isAmount(el.textContent));
   if(amount){amount.textContent='PAID';return;}
   if(card===root)break;
  }
 }
}
async function loadExistingRegistrationStatusV245(){
 if(existingRegistrationStatusRequestV245)return;
 existingRegistrationStatusRequestV245=true;
 try{
  const result=await api('/api/account/registration-status-v245',{cache:'no-store'});
  if(result&&result.registrationPaidExisting===true){
   state.balances={...(state.balances||{}),registrationPaidExisting:true};
   applyExistingRegistrationStatusV245();
  }
 }catch(_error){}finally{existingRegistrationStatusRequestV245=false;}
}
const existingRegistrationObserverV245=new MutationObserver(()=>{applyExistingRegistrationStatusV245();if(!state.balances||state.balances.registrationPaidExisting!==true)loadExistingRegistrationStatusV245();});
const existingRegistrationRootV245=document.body;
if(existingRegistrationRootV245)existingRegistrationObserverV245.observe(existingRegistrationRootV245,{childList:true,subtree:true,characterData:true});
if(typeof renderDashboard==='function'){
 const originalRenderDashboardV245=renderDashboard;
 renderDashboard=function(){const result=originalRenderDashboardV245.apply(this,arguments);loadExistingRegistrationStatusV245();return result;};
}
loadExistingRegistrationStatusV245();
`;
}
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=266'");
fs.writeFileSync('www/app.js',app);
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="existingRegisteredMemberV245"')){
  const input=/<input\b(?=[^>]*\bid=["']newUsername["'])[^>]*>/;
  if(!input.test(html))throw Error('Stage 245: Create New Member username field markup missing.');
  const checkbox='<label class="existing-registered-member-v245" style="display:flex;align-items:center;gap:10px;margin:10px 0;font-weight:700"><input id="existingRegisteredMemberV245" name="existingRegisteredMember" type="checkbox" style="width:auto;min-width:18px;min-height:18px"> Existing Registered Member — registration already paid</label>';
  html=html.replace(input,m=>m+'\n'+checkbox);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=266').replace(/styles\.css\?v=\d+/g,'styles.css?v=266');
fs.writeFileSync('www/index.html',html);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v266';").replace(/app\.js\?v=\d+/g,'app.js?v=266').replace(/styles\.css\?v=\d+/g,'styles.css?v=266');
fs.writeFileSync('www/sw.js',sw);
/* Stage 246: allow an administrator to mark an already-existing member without recreating the account. */
let checkHtml=fs.readFileSync('www/index.html','utf8');
const checkButton='<button class="secondary" id="markExistingRegistrationV246" type="button">MARK REGISTRATION COMPLETED</button><p class="form-error" id="markExistingRegistrationResultV246" role="status"></p>';
if(checkHtml.includes('id="adminCheckUsernameV239"')&&!checkHtml.includes('id="markExistingRegistrationV246"')){
 checkHtml=checkHtml.replace(/(<input id="adminCheckUsernameV239"[^>]*>\s*<\/label>)/,'$1\n'+checkButton);
 fs.writeFileSync('www/index.html',checkHtml);
}
let checkApp=fs.readFileSync('www/app.js','utf8');
if(!checkApp.includes('markExistingRegistrationV246')){
 const handler=[
 "document.addEventListener('click',async function(event){",
 " const button=event.target&&event.target.closest?event.target.closest('#markExistingRegistrationV246'):null;",
 " if(!button)return;",
 " const input=document.getElementById('adminCheckUsernameV239');",
 " const result=document.getElementById('markExistingRegistrationResultV246');",
 " const username=String(input&&input.value||'').trim().toUpperCase();",
 " if(!username){if(result)result.textContent='Enter the member username first.';return;}",
 " button.disabled=true;button.textContent='SAVING…';if(result)result.textContent='';",
 " try{const saved=await api('/api/admin/existing-registration-v245',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});if(!saved||saved.saved!==true)throw new Error('The registration status was not confirmed as saved.');if(result)result.textContent='Registration marked COMPLETED for '+username+'. Reopen this member account to refresh the tile.';}",
 " catch(error){if(result)result.textContent='Not saved: '+(error&&error.message?error.message:'Please try again.');}",
 " finally{button.disabled=false;button.textContent='MARK REGISTRATION COMPLETED';}",
 "});"
 ].join('\n');
 checkApp += '\n'+handler+'\n';
 fs.writeFileSync('www/app.js',checkApp);
}
console.log('TAIMAKO Stage 245: existing registration checkbox and persisted status wired.');
