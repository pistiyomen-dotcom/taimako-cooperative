const fs=require('fs');
const p='www/app.js';
let s=fs.readFileSync(p,'utf8');

s=s.replace(
  "linkedField.hidden=true; linkedInput.value='';",
  "linkedField.hidden=true; linkedField.style.display='none'; linkedInput.value='';"
);

s=s.replace(
  "linkedField.hidden=false;",
  "linkedField.hidden=false; linkedField.style.display='block';"
);

fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 56 Flexible-only Regular link field enforced.');
