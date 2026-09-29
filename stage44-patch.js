const fs=require('fs');

let a=fs.readFileSync('server/routes/account.js','utf8');
const start=a.indexOf("router.get('/linked-flexible'");
const end=a.indexOf("\nmodule.exports = router;", start);
if(start>=0 && end>start){
  a=a.slice(0,start)+a.slice(end);
}
fs.writeFileSync('server/routes/account.js',a);

let h=fs.readFileSync('www/index.html','utf8');
h=h.replace(/\s*<dialog id="regularFlexibleDialog"[\s\S]*?<\/dialog>/m,'');
fs.writeFileSync('www/index.html',h);

let s=fs.readFileSync('www/app.js','utf8');
s=s.replace(", 'FLEXIBLE DEPOSIT'","");
s=s.replace(" : label === 'FLEXIBLE DEPOSIT' ? openRegularFlexibleDialog()","");
const uiStart=s.indexOf("async function openRegularFlexibleDialog()");
if(uiStart>=0){
  s=s.slice(0,uiStart);
}
fs.writeFileSync('www/app.js',s);

console.log('TAIMAKO Stage 44 removed incorrect Regular to Flexible transfer.');
