const fs=require('fs');
const app=fs.readFileSync('www/app.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
for(const term of ['const serviceContent = {','serviceContent[','serviceDialogBody.innerHTML','public-menu','BYE','SAVINGS','ABOUT US']){
  const i=app.indexOf(term);
  console.log('PUB145 APP '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(app.slice(Math.max(0,i-400),Math.min(app.length,i+4200))));
}
for(const term of ['service-grid','data-service','BYE','SAVINGS','ABOUT US']){
  const i=html.indexOf(term);
  console.log('PUB145 HTML '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(html.slice(Math.max(0,i-400),Math.min(html.length,i+3200))));
}
console.log('TAIMAKO Stage 145 public info inspection complete.');
