const fs=require('fs');
let admin=fs.readFileSync('server/routes/admin.js','utf8');

if(!admin.includes("router.get('/reset-account/confirm'")){
  const marker="router.get('/members/search'";
  const routes=`
router.get('/reset-account/confirm', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter username.'});
  const result=await pool.query("SELECT id,username,full_name,role,is_active,must_change_password FROM accounts WHERE username=$1",[username]);
  const account=result.rows[0];
  if(!account) return res.status(404).json({error:'Account not found.'});
  res.json({account:{username:account.username,name:account.full_name,role:account.role,isActive:account.is_active,mustChangePassword:account.must_change_password}});
});

router.post('/reset-account/credential', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const username=String(req.body?.username||'').trim().toUpperCase();
  const temporaryCredential=String(req.body?.temporaryCredential||'');
  if(!username) return res.status(400).json({error:'Enter username.'});
  const found=await pool.query("SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1",[username]);
  const account=found.rows[0];
  if(!account) return res.status(404).json({error:'Account not found.'});
  if(!account.is_active) return res.status(400).json({error:'Inactive account cannot be reset.'});
  const isPin=account.role==='regular'||account.role==='flexible';
  if(isPin&&!/^\\d{4}$/.test(temporaryCredential)) return res.status(400).json({error:'Temporary PIN must be exactly 4 digits.'});
  if(!isPin&&temporaryCredential.length<4) return res.status(400).json({error:'Temporary password must be at least 4 characters.'});
  const hash=await bcrypt.hash(temporaryCredential,12);
  await pool.query("UPDATE accounts SET password_hash=$1,must_change_password=TRUE,updated_at=NOW() WHERE id=$2",[hash,account.id]);
  try{await writeAdminAudit(pool,req,'ACCOUNT_CREDENTIAL_RESET','account',account.id,account.username,{role:account.role});}catch(_){}
  res.json({successful:true,account:{username:account.username,name:account.full_name,role:account.role},temporaryOnly:true});
});

router.delete('/reset-account/:username', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const username=String(req.params.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter username.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const found=await client.query("SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1 FOR UPDATE",[username]);
    const account=found.rows[0];
    if(!account){await client.query('ROLLBACK');return res.status(404).json({error:'Account not found.'});}
    if(String(account.id)===String(req.auth.sub)){await client.query('ROLLBACK');return res.status(400).json({error:'You cannot delete the administrator account currently signed in.'});}
    if(account.role==='admin'&&!(await adminPermissionAllowed(req.auth.sub,'manage_admins'))){await client.query('ROLLBACK');return res.status(403).json({error:'Your administrator account cannot delete another administrator.'});}
    await client.query("UPDATE accounts SET linked_regular_account_id=NULL WHERE linked_regular_account_id=$1",[account.id]);
    const lockHash=await bcrypt.hash('DISABLED-'+Date.now()+'-'+Math.random(),12);
    await client.query("UPDATE accounts SET is_active=FALSE,must_change_password=FALSE,password_hash=$1,updated_at=NOW() WHERE id=$2",[lockHash,account.id]);
    await client.query('COMMIT');
    try{await writeAdminAudit(pool,req,'ACCOUNT_DELETED','account',account.id,account.username,{role:account.role,historyPreserved:true});}catch(_){}
    res.json({successful:true,deletedAccount:{username:account.username,name:account.full_name,role:account.role},historyPreserved:true});
  }catch(error){try{await client.query('ROLLBACK');}catch(_){}throw error;}finally{client.release();}
});

`;
  if(!admin.includes(marker)){console.error('Stage 110 backend marker missing');process.exit(1);}
  admin=admin.replace(marker,routes+marker);
}

fs.writeFileSync('server/routes/admin.js',admin);
console.log('TAIMAKO Stage 110 Admin RESET backend applied.');