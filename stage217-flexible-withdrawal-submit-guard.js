const fs=require('fs');
const file='server/routes/account.js';
let s=fs.readFileSync(file,'utf8');
const a="router.post('/withdrawal-requests', requireAuth, async (req, res) => {";
const b="  res.status(201).json({ request: result.rows[0] });\n});";
if(!s.includes(a)||!s.includes(b))throw Error('Withdrawal request route markers not found');
s=s.replace(a,a+"\n  try {");
s=s.replace(b,`  res.status(201).json({ request: result.rows[0] });
  } catch(error) {
    console.error('Withdrawal request submission failed:',error);
    if(!res.headersSent)res.status(500).json({error:'Withdrawal request could not be submitted. Please try again or contact Admin if the problem continues.'});
  }
});`);
fs.writeFileSync(file,s);
let app=fs.readFileSync('www/app.js','utf8');
const marker="withdrawalForm.addEventListener('submit', async (e) => {";
if(!app.includes(marker))throw Error('Withdrawal form submit handler not found');
app=app.replace(marker,`/* Guard against native form navigation on all devices if a submit fails. */
withdrawalForm.addEventListener('submit',event=>event.preventDefault(),true);
`+marker);
fs.writeFileSync('www/app.js',app);
console.log('Withdrawal form navigation guarded; server errors caught and returned to member instead of unhandled rejection.');
