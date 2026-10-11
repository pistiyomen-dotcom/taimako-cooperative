const fs=require('fs');
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const marker="withdrawalForm.addEventListener('submit', async (e) => {";
if(!app.includes(marker))throw Error('Withdrawal form submit handler not found');
app=app.replace(marker,`/* Stop native form navigation if the withdrawal request encounters an error. */
withdrawalForm.addEventListener('submit',event=>event.preventDefault(),true);
`+marker);
fs.writeFileSync(appPath,app);
console.log('Withdrawal form native navigation guarded; no server route code modified.');
