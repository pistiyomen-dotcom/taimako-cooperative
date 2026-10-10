const fs=require('fs');
let admin=fs.readFileSync('server/routes/admin.js','utf8');
let app=fs.readFileSync('www/app.js','utf8');
const anchor="router.post('/setup-savings-plan'";
if(!admin.includes(anchor)) throw Error('SETUP route missing');
if(!admin.includes("router.get('/setup-member'")){
 const route=`router.get('/setup-member', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!/^\\d{1,5}$/.test(username)) return res.status(400).json({error:'Enter a valid Regular member username.'});
  const result=await pool.query("SELECT username,full_name,role,is_active FROM accounts WHERE username=$1",[username]);
  const member=result.rows[0];
  if(!member||!member.is_active) return res.status(404).json({error:'Active member account not found.'});
  if(member.role!=='regular') return res.status(400).json({error:'SETUP is for Regular member accounts.'});
  res.set('Cache-Control','no-store');
  res.json({member:{username:member.username,name:member.full_name,role:member.role}});
});

`;
 admin=admin.replace(anchor,route+anchor);
}
const old="api('/api/admin/members/search?username='+encodeURIComponent(username),{cache:'no-store'})";
if(!app.includes(old))throw Error('Old SETUP lookup missing');
app=app.replace(old,"api('/api/admin/setup-member?username='+encodeURIComponent(username),{cache:'no-store'})");
const assign="const member=data.account;";
if(!app.includes(assign))throw Error('SETUP response marker missing');
app=app.replace(assign,"const member=data.member;");
if(app.includes(old))throw Error('Obsolete SETUP lookup still present');
fs.writeFileSync('server/routes/admin.js',admin);
fs.writeFileSync('www/app.js',app);
let html=fs.readFileSync('www/index.html','utf8').replace(/app\\.js\\?v=\\d+/g,'app.js?v=208');
fs.writeFileSync('www/index.html',html);
console.log('Stage 208 SETUP uses independent admin-authorized member verification.');
