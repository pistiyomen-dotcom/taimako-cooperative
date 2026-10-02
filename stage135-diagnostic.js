const fs=require('fs');
const s=fs.readFileSync('server/routes/admin.js','utf8');
console.log('VERIFY135 PAYMENT_REQUEST_APPROVED '+(s.includes("PAYMENT_REQUEST_APPROVED")?'FOUND':'NOT_FOUND'));
const i=s.indexOf("router.post('/payment-requests/:id/approve'");
if(i>=0) console.log(JSON.stringify(s.slice(i,Math.min(s.length,i+4300))));
