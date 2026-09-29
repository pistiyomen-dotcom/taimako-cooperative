const fs = require('fs');
const path = 'server/routes/public.js';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes("const bcrypt=require('bcryptjs');")) {
  s = s.replace("const crypto=require('crypto');", "const crypto=require('crypto');\nconst bcrypt=require('bcryptjs');");
}

const route = `
router.post('/bootstrap-admin', async (req,res)=>{
  if(String(process.env.BOOTSTRAP_ADMIN_ENABLED||'').toLowerCase()!=='true') {
    return res.status(404).json({error:'Not found.'});
  }
  const suppliedToken=String(req.headers['x-bootstrap-token']||'');
  const expectedToken=String(process.env.BOOTSTRAP_ADMIN_TOKEN||'');
  if(!expectedToken || suppliedToken.length!==expectedToken.length ||
     !crypto.timingSafeEqual(Buffer.from(suppliedToken),Buffer.from(expectedToken))) {
    return res.status(403).json({error:'Bootstrap authorization failed.'});
  }

  const existing=await pool.query("SELECT COUNT(*)::int AS count FROM accounts WHERE role='admin'");
  if(Number(existing.rows[0]?.count||0)>0) {
    return res.status(409).json({error:'An administrator already exists. Bootstrap is no longer available.'});
  }

  const username=String(req.body?.username||'').trim().toUpperCase();
  const fullName=String(req.body?.fullName||'').trim();
  const password=String(req.body?.password||'');
  if(!/^\\d{5}$/.test(username)) return res.status(400).json({error:'Administrator username must be exactly 5 digits.'});
  if(!fullName || fullName.length>160) return res.status(400).json({error:'Enter the administrator name.'});
  if(password.length<10) return res.status(400).json({error:'Temporary administrator password must contain at least 10 characters.'});

  const hash=await bcrypt.hash(password,12);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(
      "INSERT INTO accounts(username,full_name,role,password_hash,must_change_password) VALUES($1,$2,'admin',$3,TRUE) RETURNING id,username,full_name,role,must_change_password",
      [username,fullName,hash]
    );
    await client.query('INSERT INTO member_balances(account_id) VALUES($1) ON CONFLICT(account_id) DO NOTHING',[result.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({ok:true,user:{username:result.rows[0].username,name:result.rows[0].full_name,role:result.rows[0].role,mustChangePassword:true}});
  }catch(error){
    await client.query('ROLLBACK');
    if(error.code==='23505') return res.status(409).json({error:'That username already exists.'});
    throw error;
  }finally{client.release();}
});
`;

if (!s.includes("router.post('/bootstrap-admin'")) {
  s = s.replace("module.exports=router;", route + "\nmodule.exports=router;");
}

fs.writeFileSync(path, s);
console.log('TAIMAKO Stage 17 secure admin bootstrap applied.');