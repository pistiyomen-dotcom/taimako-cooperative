const fs=require('fs');
const s=fs.readFileSync('server/routes/admin.js','utf8');
for(const term of ["router.post('/payment-requests/:id/approve'","PAYMENT_REQUEST_APPROVED","writeAdminAudit"]){
  const i=s.indexOf(term);
  console.log('AUDIT133 '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(s.slice(Math.max(0,i-600),Math.min(s.length,i+4200))));
}
