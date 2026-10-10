const fs=require('fs');
const files=['www/app.js','server/routes/account.js','server/routes/admin.js','server/index.js'];
const patterns={
 'www/app.js':['const state','async function api(','function renderDashboard()','function renderApp()','async function refreshAccount()','memberLookupFreshGrid(bal)'],
 'server/routes/account.js':['router.get(\'/me\'','router.get(\'/dashboard\'','router.post(\'/payment-requests\'','router.post(\'/withdrawal'],
 'server/routes/admin.js':['router.get(\'/members/search\'','function requireAdminPermission','router.get(\'/members/'],
 'server/index.js':['app.use(\'/api/account\'','app.use(\'/api/admin\'']
};
for(const file of files){
 const src=fs.readFileSync(file,'utf8');
 for(const pattern of patterns[file]){
  const i=src.indexOf(pattern);
  console.log('INSPECT',file,pattern,'offset',i);
  if(i>=0)console.log(src.slice(Math.max(0,i-200),Math.min(src.length,i+2500)).replace(/(password|token|secret)(.{0,20})/gi,'[redacted]'));
 }
}

const auth=fs.readFileSync('server/middleware/auth.js','utf8');
console.log('AUTH MIDDLEWARE SOURCE',auth.replace(/(password|secret|token)(.{0,20})/gi,'[credential-ref]'));
const app=fs.readFileSync('www/app.js','utf8');
for(const p of ['async function api(path','function renderDashboard()','function renderApp()','function dashboardCards(role)']){
 const i=app.indexOf(p);
 console.log('FUNCTION',p,'OFFSET',i,'BODY',i>=0?app.slice(i,i+1200).replace(/(password|secret|token)(.{0,20})/gi,'[credential-ref]'):'not found');
}
