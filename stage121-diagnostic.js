const fs=require('fs');
const s=fs.readFileSync('www/app.js','utf8');
for(const term of ['async function api','function api','const api =','const api=']){
  const i=s.indexOf(term);
  if(i>=0){console.log('API_HELPER '+JSON.stringify(s.slice(Math.max(0,i-300),Math.min(s.length,i+2400))));break;}
}
