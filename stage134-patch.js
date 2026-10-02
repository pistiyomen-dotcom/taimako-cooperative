const fs=require('fs');

let admin=fs.readFileSync('server/routes/admin.js','utf8');

const routeStart=admin.indexOf("router.post('/payment-requests/:id/approve'");
if(routeStart<0){console.error('Stage 134 approval route not found');process.exit(1);}
const routeEnd=admin.indexOf("\nrouter.",routeStart+10);
const end=routeEnd>routeStart?routeEnd:admin.length;
let route=admin.slice(routeStart,end);

if(!route.includes("PAYMENT_REQUEST_APPROVED")){
  const marker="res.json({ request: updated.rows[0] });";
  if(!route.includes(marker)){console.error('Stage 134 approval response marker not found');process.exit(1);}
  route=route.replace(
    marker,
    "await writeAdminAudit(client,req,'PAYMENT_REQUEST_APPROVED','payment_request',request.id,request.username,{destination:request.destination,amount:Number(request.amount),reference:request.reference});\n    "+marker
  );
  admin=admin.slice(0,routeStart)+route+admin.slice(end);
}

fs.writeFileSync('server/routes/admin.js',admin);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=134');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=134');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=134');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v134';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 134 bank-transfer approval audit logging applied.');
