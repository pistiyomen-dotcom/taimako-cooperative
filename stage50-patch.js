const fs=require('fs');

let pub=fs.readFileSync('server/routes/public.js','utf8');

if(!pub.includes("router.post('/admin-setup'")){
  const route=`
router.post('/admin-setup', async (req,res)=>{
  const crypto=require('crypto');
  const recoveryKey='stage50_admin_setup_completed';

  await pool.query(\`CREATE TABLE IF NOT EXISTS system_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )\`);

  const done=await pool.query('SELECT 1 FROM system_migrations WHERE migration_key=$1',[recoveryKey]);
  if(done.rowCount) return res.status(410).json({error:'Admin setup has already been completed.'});

  const setupCode=String(req.body?.setupCode||'').trim();
  const supplied=crypto.createHash('sha256').update(setupCode).digest('hex');
  const expected='3f76b269a3df885b52f45b7d0a1b8f9ec669d8265c4b93951f838328b8cfa19c';
  if(supplied.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))){
    return res.status(403).json({error:'Setup code is incorrect.'});
  }

  const username=String(req.body?.username||'').trim().toUpperCase();
  const fullName=String(req.body?.fullName||'').trim();
  const password=String(req.body?.password||'');

  if(!/^[A-Z0-9_-]{3,20}$/.test(username)) return res.status(400).json({error:'Admin username must be 3-20 letters, numbers, underscore or hyphen.'});
  if(!fullName || fullName.length>160) return res.status(400).json({error:'Enter the administrator name.'});
  if(password.length<8) return res.status(400).json({error:'Temporary administrator password must contain at least 8 characters.'});

  const hash=await bcrypt.hash(password,12);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');

    const clash=await client.query("SELECT id,role FROM accounts WHERE username=$1 FOR UPDATE",[username]);
    const existingAdmin=await client.query("SELECT id FROM accounts WHERE role='admin' ORDER BY id ASC LIMIT 1 FOR UPDATE");

    let adminId;
    if(existingAdmin.rowCount){
      adminId=existingAdmin.rows[0].id;
      if(clash.rowCount && clash.rows[0].id!==adminId){
        await client.query('ROLLBACK');
        return res.status(409).json({error:'That username is already used by another account.'});
      }
      await client.query(
        "UPDATE accounts SET username=$1,full_name=$2,password_hash=$3,must_change_password=TRUE,is_active=TRUE,updated_at=NOW() WHERE id=$4",
        [username,fullName,hash,adminId]
      );
    }else{
      if(clash.rowCount){
        await client.query('ROLLBACK');
        return res.status(409).json({error:'That username is already used by another account.'});
      }
      const created=await client.query(
        "INSERT INTO accounts(username,full_name,role,password_hash,must_change_password,is_active) VALUES($1,$2,'admin',$3,TRUE,TRUE) RETURNING id",
        [username,fullName,hash]
      );
      adminId=created.rows[0].id;
      await client.query('INSERT INTO member_balances(account_id) VALUES($1) ON CONFLICT(account_id) DO NOTHING',[adminId]);
    }

    await client.query('INSERT INTO system_migrations(migration_key) VALUES($1)',[recoveryKey]);
    await client.query('COMMIT');

    res.status(201).json({
      ok:true,
      user:{username,name:fullName,role:'admin',mustChangePassword:true}
    });
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
  }
});
`;
  pub=pub.replace('module.exports=router;',route+'\nmodule.exports=router;');
}
fs.writeFileSync('server/routes/public.js',pub);

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="adminSetupDialog"')){
  const marker='  <dialog id="passwordDialog">';
  const dialog=`
  <dialog id="adminSetupDialog">
    <form class="dialog-card" id="adminSetupForm">
      <div class="dialog-head">
        <h3>One-Time Admin Setup</h3>
        <button type="button" class="icon-btn" data-close="adminSetupDialog" aria-label="Close">×</button>
      </div>
      <p class="helper">Use this once to set the preferred administrator login. After successful setup, this option is permanently disabled.</p>
      <label>Setup Code<input id="adminSetupCode" autocomplete="off" required /></label>
      <label>Preferred Admin Username<input id="adminSetupUsername" placeholder="e.g. Shugaba" required /></label>
      <label>Admin Full Name<input id="adminSetupFullName" required /></label>
      <label>Temporary Password<input id="adminSetupPassword" type="password" autocomplete="new-password" required /></label>
      <button class="primary" type="submit">COMPLETE ADMIN SETUP</button>
      <p class="form-error" id="adminSetupError" role="alert"></p>
      <p class="form-success" id="adminSetupSuccess" role="status"></p>
    </form>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 50 password dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
if(!html.includes('id="openAdminSetup"')){
  const marker='<p class="helper">Regular members, Flexible savers and administrators use this same login entry point.</p>';
  const repl=marker+'<p><button type="button" class="secondary" id="openAdminSetup">ADMIN SETUP</button></p>';
  if(!html.includes(marker)){console.error('Stage 50 login helper marker missing');process.exit(1);}
  html=html.replace(marker,repl);
}
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes("const adminSetupDialog = document.getElementById('adminSetupDialog');")){
  const marker="const contactsAdminError = document.getElementById('contactsAdminError');";
  const vars=`
const adminSetupDialog = document.getElementById('adminSetupDialog');
const adminSetupForm = document.getElementById('adminSetupForm');
const adminSetupError = document.getElementById('adminSetupError');
const adminSetupSuccess = document.getElementById('adminSetupSuccess');
`;
  if(!app.includes(marker)){console.error('Stage 50 app variable marker missing');process.exit(1);}
  app=app.replace(marker,marker+'\n'+vars);
}

if(!app.includes("document.getElementById('openAdminSetup')?.addEventListener")){
  const marker="contactForm.addEventListener('submit', async (e) => {";
  const handler=`
document.getElementById('openAdminSetup')?.addEventListener('click',()=>{
  loginDialog.close();
  adminSetupForm.reset();
  adminSetupError.textContent='';
  adminSetupSuccess.textContent='';
  openDialog(adminSetupDialog);
});

adminSetupForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  adminSetupError.textContent='';
  adminSetupSuccess.textContent='';
  try{
    const result=await api('/api/public/admin-setup',{
      method:'POST',
      body:JSON.stringify({
        setupCode:document.getElementById('adminSetupCode').value,
        username:document.getElementById('adminSetupUsername').value,
        fullName:document.getElementById('adminSetupFullName').value,
        password:document.getElementById('adminSetupPassword').value
      })
    });
    adminSetupSuccess.textContent='Admin setup completed. Username: '+result.user.username+'. Close this window and log in with the temporary password.';
  }catch(error){
    adminSetupError.textContent=error.message;
  }
});

`;
  if(!app.includes(marker)){console.error('Stage 50 contact form marker missing');process.exit(1);}
  app=app.replace(marker,handler+marker);
}
fs.writeFileSync('www/app.js',app);

console.log('TAIMAKO Stage 50 one-time preferred Admin setup applied.');
