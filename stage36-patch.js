const fs=require('fs');
const p='www/app.js';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('tmcsGuard')){s+="\ndocument.addEventListener('submit',e=>{const f=e.target;if(!(f instanceof HTMLFormElement))return;if(f.dataset.tmcsGuard==='1'){e.preventDefault();return;}f.dataset.tmcsGuard='1';setTimeout(()=>{f.dataset.tmcsGuard='0';},3000);},true);\n";}
fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 36 duplicate-submit guard applied.');

require('./stage37-patch.js');
