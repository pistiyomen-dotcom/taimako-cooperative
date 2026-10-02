const fs=require('fs');
const s=fs.readFileSync('server/index.js','utf8');
for(const term of ["express.static","app.get('*'","app.get('/*'","app.get('/api/public/bank-details'","app.use((req"]){
  const i=s.indexOf(term);
  console.log('ROUTEORDER128 '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(s.slice(Math.max(0,i-500),Math.min(s.length,i+1400))));
}
const a=fs.readFileSync('www/app.js','utf8');
for(const term of ['const API_BASE','let API_BASE','var API_BASE','async function api(']){
  const i=a.indexOf(term);
  console.log('APP128 '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(a.slice(Math.max(0,i-300),Math.min(a.length,i+1500))));
}
