const fs=require('fs');

// Stage 239: controlled Admin CHECK assisted-account access.
const authPath='server/middleware/auth.js';
let auth=fs.readFileSync(authPath,'utf8');
if(!auth.includes("const pool = require('../db/pool');")) auth=auth.replace("const jwt = require('jsonwebtoken');","const jwt = require('jsonwebtoken');\nconst pool = require('../db/pool');");
const a0=auth.indexOf('function requireAuth(req, res, next) {');
const a1=auth.indexOf('\n}\n\nmodule.exports',a0);
if(a0<0||a1<0) throw Error('Stage 239: auth middleware boundary missing.');
const authFn=[
"async function requireAuth(req, res, next) {",
"  const header=req.get('authorization')||'';",
"  const token=header.startsWith('Bearer ')?header.slice(7):null;",
"  if(!token)return res.status(401).json({error:'Authentication required.'});",
"  try {",
"    req.auth=jwt.verify(token,process.env.JWT_SECRET);",
"    const headerAccount=String(req.get('x-tmcs-assisted-account')||'').trim();",
"    if(headerAccount && req.baseUrl==='/api/account'){",
"      if(req.auth.role!=='admin')return res.status(403).json({error:'Only an administrator can open an assisted member session.'});",
"      const targetId=Number(headerAccount);",
"      if(!Number.isSafeInteger(targetId)||targetId<=0)return res.status(400).json({error:'Invalid assisted account.'});",
"      const permission=await pool.query('SELECT manage_accounts FROM admin_permissions WHERE account_id=$1',[req.auth.sub]);",
"      if(permission.rows.length&&permission.rows[0].manage_accounts!==true)return res.status(403).json({error:'Your administrator account does not have permission to assist member accounts.'});",
"      const found=await pool.query('SELECT id,username,full_name,role,is_active FROM accounts WHERE id=$1',[targetId]);",
"      const target=found.rows[0];",
"      if(!target||!target.is_active||!['regular','flexible'].includes(String(target.role||'').toLowerCase()))return res.status(404).json({error:'Active Regular or Flexible account not found.'});",
"      const adminId=req.auth.sub;",
"      req.auth.actorSub=adminId;req.auth.actorUsername=req.auth.username||null;req.auth.assisted=true;req.auth.assistedTargetId=target.id;req.auth.assistedTargetUsername=target.username;",
"      req.auth.sub=String(target.id);req.auth.username=target.username;req.auth.name=target.full_name;req.auth.role=String(target.role).toLowerCase();",
"      if(['POST','PUT','PATCH','DELETE'].includes(req.method))res.on('finish',()=>{if(res.statusCode<400)pool.query('INSERT INTO admin_audit_log(admin_account_id,action_code,target_type,target_id,target_username,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[adminId,'ASSISTED_MEMBER_ACTION','account',String(target.id),target.username,JSON.stringify({method:req.method,path:req.originalUrl,statusCode:res.statusCode})]).catch(error=>console.error('Assisted-account audit write failed:',error.message));});",
"    }",
"    next();",
"  } catch(error) {",
"    if(error&&(error.name==='JsonWebTokenError'||error.name==='TokenExpiredError'))return res.status(401).json({error:'Session is invalid or expired.'});",
"    next(error);",
"  }",
"}"
].join('\n');
auth=auth.slice(0,a0)+authFn+auth.slice(a1+2);
fs.writeFileSync(authPath,auth);

let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.get('/check-account'")){
 const routes=[
 "router.get('/check-account',requireAdminPermission('manage_accounts'),async(req,res)=>{",
 " const username=String(req.query.username||'').trim().toUpperCase();",
 " if(!username)return res.status(400).json({error:'Enter a Regular or Flexible username.'});",
 " const result=await pool.query('SELECT a.id,a.username,a.full_name,a.role,a.is_active,b.registration,b.regular,b.target,b.constant,b.welfare,b.flexible,b.loan_principal,b.loan_interest,b.loan_due_date,b.flexible_start_date,b.dividend,b.membership_card,b.flexible_card,b.application_form FROM accounts a LEFT JOIN member_balances b ON b.account_id=a.id WHERE a.username=$1',[username]);",
 " const row=result.rows[0];",
 " if(!row||!row.is_active||!['regular','flexible'].includes(String(row.role||'').toLowerCase()))return res.status(404).json({error:'No active Regular or Flexible account found for that username.'});",
 " await writeAdminAudit(pool,req,'ASSISTED_ACCOUNT_OPENED','account',row.id,row.username,{role:row.role});",
 " res.set('Cache-Control','no-store');",
 " res.json({account:{id:row.id,username:row.username,name:row.full_name,role:row.role},balances:balanceView(row)});",
 "});",
 "router.post('/check-account/close',requireAdminPermission('manage_accounts'),async(req,res)=>{",
 " const username=String(req.body&&req.body.username||'').trim().toUpperCase();",
 " if(!username)return res.status(400).json({error:'Member username is required.'});",
 " const found=await pool.query(\"SELECT id,username,role FROM accounts WHERE username=$1 AND role IN ('regular','flexible')\",[username]);",
 " if(!found.rows[0])return res.status(404).json({error:'Member account not found.'});",
 " await writeAdminAudit(pool,req,'ASSISTED_ACCOUNT_CLOSED','account',found.rows[0].id,found.rows[0].username,{role:found.rows[0].role});",
 " res.json({closed:true});",
 "});",
 ""
 ].join('\n');
 const anchor='\nmodule.exports = router;';
 if(!admin.includes(anchor))throw Error('Stage 239: admin router export boundary missing.');
 admin=admin.replace(anchor,'\n'+routes+anchor);
}
fs.writeFileSync('server/routes/admin.js',admin);

let account=fs.readFileSync('server/routes/account.js','utf8');
let pos=0;
while((pos=account.indexOf('INSERT INTO transactions',pos))>=0){
 let end=account.indexOf(');',pos);
 if(end<0)throw Error('Stage 239: transaction insert boundary missing.');
 end+=2;
 let block=account.slice(pos,end);
 const matches=[...block.matchAll(/req\.auth\.sub/g)];
 if(matches.length){
  const m=matches[matches.length-1];
  block=block.slice(0,m.index)+'(req.auth.actorSub || req.auth.sub)'+block.slice(m.index+m[0].length);
  account=account.slice(0,pos)+block+account.slice(end);
  end=pos+block.length;
 }
 pos=end;
}
account=account.replace("VALUES($1,$2,$2,'flexible_transfer_out','FLEXIBLE',$3,'completed',$4,NOW())","VALUES($1,$2,$3,'flexible_transfer_out','FLEXIBLE',$4,'completed',$5,NOW())");
account=account.replace("[`${reference}-D`, source.id, amount, `Transfer ${reference} to ${target.username} ${destination}${note ? ` • ${note}` : ''}`]","[`${reference}-D`, source.id, (req.auth.actorSub || source.id), amount, `Transfer ${reference} to ${target.username} ${destination}${note ? ` • ${note}` : ''}`]");
account=account.replace("[`${reference}-C`, target.id, source.id, destination, amount, `Transfer ${reference} from ${source.username}${note ? ` • ${note}` : ''}`]","[`${reference}-C`, target.id, (req.auth.actorSub || source.id), destination, amount, `Transfer ${reference} from ${source.username}${note ? ` • ${note}` : ''}`]");
fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes("['CHECK', 'Assist a Regular or Flexible member in the office']"))app=app.replace("['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],","['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],\n    ['CHECK', 'Assist a Regular or Flexible member in the office'],");
if(!app.includes("if (title === 'CHECK')"))app=app.replace("if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }","if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }\n  if (title === 'CHECK') { openAdminCheckDialogV239(); }");
if(!app.includes('function openAdminCheckDialogV239()')){
 const apiMarker='async function api(path, options = {}) {';
 if(!app.includes(apiMarker))throw Error('Stage 239: API helper marker missing.');
 const helper=[
 "function openAdminCheckDialogV239(){",
 " const dialog=document.getElementById('adminCheckDialogV239'),form=document.getElementById('adminCheckFormV239'),input=document.getElementById('adminCheckUsernameV239'),error=document.getElementById('adminCheckErrorV239');",
 " if(!dialog||!form||!input||!error)return;",
 " error.textContent='';input.value='';openDialog(dialog);input.focus();",
 " form.onsubmit=async(event)=>{",
 "  event.preventDefault();error.textContent='';const button=document.getElementById('adminCheckOpenV239');const username=String(input.value||'').trim().toUpperCase();",
 "  if(!username){error.textContent='Enter a Regular or Flexible username.';return;}",
 "  if(button){button.disabled=true;button.textContent='OPENING…';}",
 "  try{",
 "   const found=await api('/api/admin/check-account?username='+encodeURIComponent(username),{cache:'no-store'});const account=found.account;",
 "   if(!account||!account.id)throw new Error('Active Regular or Flexible account not found.');",
 "   state.assistedAdminSnapshot={user:state.user,balances:state.balances};state.assistedAccountId=Number(account.id);state.assistedAccountUsername=account.username;",
 "   const member=await api('/api/account/me',{cache:'no-store'});state.user=member.user;state.balances=member.balances;dialog.close();renderDashboard();",
 "  }catch(err){state.assistedAccountId=null;state.assistedAccountUsername=null;state.assistedAdminSnapshot=null;error.textContent=err&&err.message?err.message:'Unable to open member account.';}",
 "  finally{if(button){button.disabled=false;button.textContent='OPEN';}}",
 " };",
 "}",
 "function exitAssistedAccountV239(){",
 " const snapshot=state.assistedAdminSnapshot,username=state.assistedAccountUsername;",
 " if(!snapshot){state.assistedAccountId=null;state.assistedAccountUsername=null;return;}",
 " api('/api/admin/check-account/close',{method:'POST',body:JSON.stringify({username:username})}).catch(()=>{});",
 " state.assistedAccountId=null;state.assistedAccountUsername=null;state.assistedAdminSnapshot=null;state.user=snapshot.user;state.balances=snapshot.balances;renderDashboard();",
 "}",
 ""
 ].join('\n');
 app=app.replace(apiMarker,helper+'\n'+apiMarker);
}
if(!app.includes("headers['X-TMCS-Assisted-Account']"))app=app.replace(/(if \(state\.token\) headers\.Authorization = .*;\n)/,"$1  if(state.assistedAccountId && String(path).startsWith('/api/account/')) headers['X-TMCS-Assisted-Account']=String(state.assistedAccountId);\n");
if(!app.includes('assisted-member-banner-v239')){
 const dash=app.indexOf('function renderDashboard() {'),marker="  dashboardContent.innerHTML = '';",at=app.indexOf(marker,dash);
 if(dash<0||at<0)throw Error('Stage 239: dashboard render marker missing.');
 const banner=[
 "  dashboardContent.innerHTML = '';",
 "  if(state.assistedAccountId){",
 "    const banner=document.createElement('div');banner.className='assisted-member-banner-v239';banner.style.cssText='display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px;margin-bottom:14px;border:2px solid #b7791f;border-radius:10px;background:#fff8e7;color:#3b2a0a;font-weight:700';",
 "    const label=document.createElement('span');label.textContent='ASSISTED MEMBER ACCOUNT — Administrator: '+String(state.assistedAdminSnapshot&&state.assistedAdminSnapshot.user&&state.assistedAdminSnapshot.user.username||'Admin');",
 "    const exit=document.createElement('button');exit.type='button';exit.className='secondary';exit.textContent='EXIT ASSISTED ACCOUNT';exit.addEventListener('click',exitAssistedAccountV239);",
 "    banner.append(label,exit);dashboardContent.appendChild(banner);",
 "  }"
 ].join('\n');
 app=app.slice(0,at)+banner+app.slice(at+marker.length);
}
app=app.replace("'CREATE ACCOUNT':'manage_accounts',","'CREATE ACCOUNT':'manage_accounts',\n    'CHECK':'manage_accounts',");
app=app.replace("'CREATE ACCOUNT','ADMIN PERMISSIONS','CASH CREDIT'","'CREATE ACCOUNT','CHECK','ADMIN PERMISSIONS','CASH CREDIT'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="adminCheckDialogV239"')){
 const dialog=[
 "  <dialog id=\"adminCheckDialogV239\">",
 "    <form class=\"dialog-card\" id=\"adminCheckFormV239\">",
 "      <div class=\"dialog-head\"><h3>CHECK — Member Account</h3><button type=\"button\" class=\"icon-btn\" data-close=\"adminCheckDialogV239\" aria-label=\"Close\">×</button></div>",
 "      <p class=\"helper\">Enter a Regular username (up to 5 digits) or Flexible username (F + 3 digits). OPEN loads the member account for office assistance.</p>",
 "      <label>Regular / Flexible Username<input id=\"adminCheckUsernameV239\" autocomplete=\"off\" autocapitalize=\"characters\" style=\"text-transform:uppercase\" required /></label>",
 "      <button class=\"primary\" id=\"adminCheckOpenV239\" type=\"submit\">OPEN</button>",
 "      <p class=\"form-error\" id=\"adminCheckErrorV239\" role=\"alert\"></p>",
 "    </form>",
 "  </dialog>"
 ].join('\n');
 if(!html.includes('</body>'))throw Error('Stage 239: HTML body close marker missing.');
 html=html.replace('</body>',dialog+'\n</body>');
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=239').replace(/styles\.css\?v=\d+/g,'styles.css?v=239').replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=239').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=239');
fs.writeFileSync('www/index.html',html);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v239';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 239 CHECK assisted member account access applied.');
