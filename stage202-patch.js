const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

if(!account.includes('async function delegatedMemberV207')){
  const marker=/const\s+router\s*=\s*express\.Router\(\);/;
  const found=account.match(marker);
  if(!found){console.error('Stage 202 router marker missing');process.exit(1);}

  const code=`
async function delegatedMemberV207(req,res,next){
  const username=String(req.headers['x-tmcs-member-service']||'').trim().toUpperCase();
  if(!username) return next();

  const operatorId=Number(req.auth?.sub||0);
  const operatorRole=String(req.auth?.role||'').toLowerCase();
  if(operatorRole!=='admin' || !operatorId){
    return res.status(403).json({error:'Administrator access is required.'});
  }

  try{
    const permission=await pool.query('SELECT manage_accounts FROM admin_permissions WHERE account_id=$1',[operatorId]);
    if(permission.rowCount && permission.rows[0].manage_accounts!==true){
      return res.status(403).json({error:'Your administrator account does not have permission for member assistance.'});
    }

    const result=await pool.query(
      "SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1 LIMIT 1",
      [username]
    );
    const member=result.rows[0];
    if(!member || !member.is_active || !['regular','flexible'].includes(String(member.role||'').toLowerCase())){
      return res.status(404).json({error:'Active Regular or Flexible member account not found.'});
    }

    req.memberService={
      operatorId,
      memberId:Number(member.id),
      memberUsername:member.username,
      memberName:member.full_name,
      memberRole:member.role,
      startedAt:new Date()
    };

    req.auth={...req.auth,sub:Number(member.id),role:member.role,username:member.username};

    if(!['GET','HEAD','OPTIONS'].includes(String(req.method||'').toUpperCase())){
      res.on('finish',()=>{
        if(res.statusCode>=400 || !req.memberService) return;
        const ctx=req.memberService;
        Promise.resolve().then(async()=>{
          try{
            // Never reassign transaction ownership by timestamp. Each financial write
            // must attribute the operator atomically in its own transaction.
            await pool.query(
              "INSERT INTO admin_audit_log(admin_account_id,action_code,target_type,target_id,target_username,details) VALUES($1,'MEMBER_ASSISTANCE','account',$2,$3,$4::jsonb)",
              [ctx.operatorId,String(ctx.memberId),ctx.memberUsername,JSON.stringify({method:req.method,path:req.originalUrl||req.url||'',status:res.statusCode,memberAccountId:ctx.memberId,operatorAccountId:ctx.operatorId,at:new Date().toISOString()})]
            );
          }catch(error){
            console.error('Member assistance audit failed:',error.message);
          }
        });
      });
    }

    next();
  }catch(error){
    next(error);
  }
}
`;

  account=account.replace(found[0],found[0]+code);
}

account=account.replace(/,\s*requireAuth\s*,/g,', requireAuth, delegatedMemberV207,');
fs.writeFileSync('server/routes/account.js',account);

console.log('TAIMAKO Stage 202 preliminary member assistance audit; financial writes still require atomic operator attribution.');
