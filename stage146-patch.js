const fs=require('fs');

/* ---------- persistent public information table ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS public_information')){
  const sql=`
CREATE TABLE IF NOT EXISTS public_information (
  section_key VARCHAR(40) PRIMARY KEY,
  content_text TEXT NOT NULL DEFAULT '',
  updated_by_account_id BIGINT REFERENCES accounts(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
  schema=schema.replace('\nCOMMIT;',sql+'\nCOMMIT;');
  fs.writeFileSync('server/db/schema.sql',schema);
}

/* ---------- admin API ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.get('/public-information'")){
  const marker="router.post('/accounts'";
  const routes=`
router.get('/public-information', requireAdminPermission('manage_accounts'), async (_req,res)=>{
  const result=await pool.query('SELECT section_key,content_text,updated_at FROM public_information ORDER BY section_key');
  res.json({sections:result.rows});
});

router.put('/public-information/:key', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const key=String(req.params.key||'').trim().toUpperCase();
  const allowed=['SAVINGS','LOAN','INVESTMENT','AGRICULTURE','FLEXIBLE','MEMBERSHIP','ABOUT US','BYE-LAW'];
  if(!allowed.includes(key)) return res.status(400).json({error:'Invalid public information section.'});
  const content=String(req.body?.content||'').trim();
  if(!content) return res.status(400).json({error:'Public information cannot be empty.'});
  if(content.length>12000) return res.status(400).json({error:'Public information is too long.'});
  const result=await pool.query(
    "INSERT INTO public_information(section_key,content_text,updated_by_account_id,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(section_key) DO UPDATE SET content_text=EXCLUDED.content_text,updated_by_account_id=EXCLUDED.updated_by_account_id,updated_at=NOW() RETURNING section_key,content_text,updated_at",
    [key,content,req.auth.sub]
  );
  await writeAdminAudit(pool,req,'UPDATE_PUBLIC_INFORMATION','public_information',key,null,{section:key});
  res.json({section:result.rows[0]});
});

`;
  if(!admin.includes(marker)){console.error('Stage 146 admin route marker missing');process.exit(1);}
  admin=admin.replace(marker,routes+marker);
  fs.writeFileSync('server/routes/admin.js',admin);
}

/* ---------- public read API before catch-all ---------- */
let index=fs.readFileSync('server/index.js','utf8');
if(!index.includes("app.get('/api/public/information'")){
  const marker="app.get('*'";
  const route=`
  app.get('/api/public/information', async (_req,res,next)=>{
    try{
      const result=await pool.query('SELECT section_key,content_text,updated_at FROM public_information ORDER BY section_key');
      const sections=Object.fromEntries(result.rows.map(r=>[r.section_key,{content:r.content_text,updatedAt:r.updated_at}]));
      res.set('Cache-Control','no-store, no-cache, must-revalidate');
      res.json({sections});
    }catch(error){next(error);}
  });

`;
  if(!index.includes(marker)){console.error('Stage 146 public route catch-all marker missing');process.exit(1);}
  index=index.replace(marker,route+marker);
  fs.writeFileSync('server/index.js',index);
}

/* ---------- Admin editor dialog ---------- */
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="publicInformationDialog"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog=`
  <dialog id="publicInformationDialog" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>PUBLIC INFORMATION</h3><button type="button" class="icon-btn" data-close="publicInformationDialog" aria-label="Close">×</button></div>
      <p class="helper">Select a home-page information section, review the current text, edit it and save.</p>
      <label>Section
        <select id="publicInformationSection">
          <option value="SAVINGS">SAVINGS</option>
          <option value="LOAN">LOAN</option>
          <option value="INVESTMENT">INVESTMENT</option>
          <option value="AGRICULTURE">AGRICULTURE</option>
          <option value="FLEXIBLE">FLEXIBLE</option>
          <option value="MEMBERSHIP">MEMBERSHIP</option>
          <option value="ABOUT US">ABOUT US</option>
          <option value="BYE-LAW">BYE-LAW</option>
        </select>
      </label>
      <label>Information
        <textarea id="publicInformationText" rows="14" maxlength="12000"></textarea>
      </label>
      <p class="helper">Use a blank line to begin a new paragraph.</p>
      <p class="form-error" id="publicInformationError" role="alert"></p>
      <p class="form-success" id="publicInformationSuccess" role="status"></p>
      <div class="dialog-actions"><button type="button" class="primary" id="savePublicInformation">SAVE INFORMATION</button></div>
    </div>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 146 public editor dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=146');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=146');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=146');
fs.writeFileSync('www/index.html',html);

/* ---------- frontend public overrides + admin editor ---------- */
let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes("['PUBLIC INFORMATION', 'Edit home-page information']")){
  const tileMarker="['SETTINGS', 'Set minimum share and registration fee'],";
  if(!app.includes(tileMarker)){console.error('Stage 146 admin tile marker missing');process.exit(1);}
  app=app.replace(tileMarker,tileMarker+"\n    ['PUBLIC INFORMATION', 'Edit home-page information'],");
}

if(!app.includes("if (title === 'PUBLIC INFORMATION')")){
  const actionMarker="if (title === 'SETTINGS') { openAdminSettingsV101(); }";
  if(!app.includes(actionMarker)){console.error('Stage 146 admin action marker missing');process.exit(1);}
  app=app.replace(actionMarker,actionMarker+"\n  if (title === 'PUBLIC INFORMATION') { openPublicInformationV146(); }");
}

if(!app.includes('tmcsPublicInfoOverridesV146')){
  const apiMarker='async function api(path, options = {}) {';
  const code=`
const tmcsPublicInfoOverridesV146={};

function publicInfoTextToHtmlV146(text){
  return String(text||'').split(/\\n\\s*\\n/).map(p=>'<p>'+escapeHTML(p.trim()).replace(/\\n/g,'<br>')+'</p>').join('');
}

async function loadPublicInformationOverridesV146(){
  try{
    const response=await fetch((API_BASE||'')+'/api/public/information',{cache:'no-store'});
    if(!response.ok) return;
    const data=await response.json();
    for(const [key,value] of Object.entries(data.sections||{})){
      if(value&&value.content) tmcsPublicInfoOverridesV146[key]=value.content;
    }
  }catch(_){}
}

loadPublicInformationOverridesV146();

const originalServiceContentV146={...serviceContent};
const publicInfoKeysV146=['SAVINGS','LOAN','INVESTMENT','AGRICULTURE','FLEXIBLE','MEMBERSHIP','ABOUT US','BYE-LAW'];

function currentPublicInfoTextV146(key){
  if(tmcsPublicInfoOverridesV146[key]) return tmcsPublicInfoOverridesV146[key];
  const temp=document.createElement('div');
  temp.innerHTML=originalServiceContentV146[key]||'';
  return (temp.innerText||temp.textContent||'').replace(/\\n{3,}/g,'\\n\\n').trim();
}

async function openPublicInformationV146(){
  const dialog=document.getElementById('publicInformationDialog');
  const select=document.getElementById('publicInformationSection');
  const text=document.getElementById('publicInformationText');
  const error=document.getElementById('publicInformationError');
  const success=document.getElementById('publicInformationSuccess');
  error.textContent=''; success.textContent='';
  try{
    const data=await api('/api/admin/public-information',{cache:'no-store'});
    for(const row of (data.sections||[])) tmcsPublicInfoOverridesV146[row.section_key]=row.content_text;
  }catch(e){ error.textContent=e.message; }
  const refresh=()=>{ text.value=currentPublicInfoTextV146(select.value); success.textContent=''; error.textContent=''; };
  select.onchange=refresh;
  refresh();
  openDialog(dialog);
}

document.getElementById('savePublicInformation')?.addEventListener('click',async()=>{
  const select=document.getElementById('publicInformationSection');
  const text=document.getElementById('publicInformationText');
  const error=document.getElementById('publicInformationError');
  const success=document.getElementById('publicInformationSuccess');
  error.textContent=''; success.textContent='';
  try{
    const key=select.value;
    const content=String(text.value||'').trim();
    if(!content) throw new Error('Enter the information to save.');
    const data=await api('/api/admin/public-information/'+encodeURIComponent(key),{
      method:'PUT',
      body:JSON.stringify({content})
    });
    tmcsPublicInfoOverridesV146[key]=data.section.content_text;
    success.textContent='PUBLIC INFORMATION SAVED SUCCESSFULLY';
  }catch(e){ error.textContent=e.message; }
});

`;
  if(!app.includes(apiMarker)){console.error('Stage 146 api marker missing');process.exit(1);}
  app=app.replace(apiMarker,code+apiMarker);
}

/* use override when a public service tile is opened */
const displayMarker="serviceDialogBody.innerHTML = serviceContent[service] || '<p>Information is being prepared.</p>';";
if(app.includes(displayMarker)){
  app=app.replace(
    displayMarker,
    "serviceDialogBody.innerHTML = tmcsPublicInfoOverridesV146[service] ? publicInfoTextToHtmlV146(tmcsPublicInfoOverridesV146[service]) : (serviceContent[service] || '<p>Information is being prepared.</p>');"
  );
}else if(!app.includes('tmcsPublicInfoOverridesV146[service]')){
  console.error('Stage 146 service display marker missing');process.exit(1);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=146'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v146';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 146 Admin-editable public information applied.');
