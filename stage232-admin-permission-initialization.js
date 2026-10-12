const fs=require('fs');
const path='www/app.js';
let app=fs.readFileSync(path,'utf8');
const original='let adminPermissionData=[];';
if(!app.includes(original))throw Error('Admin permission state declaration not found; no changes made');
app=app.replace(original,'var adminPermissionData=[];');
fs.writeFileSync(path,app);
console.log('Admin permission data state is initialized safely before early access; permission rules unchanged.');
