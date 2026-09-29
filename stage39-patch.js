const fs=require('fs');
const p='www/app.js';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('tmcsCurrentMonthLabels')){
s += `
function tmcsCurrentMonthLabels(){
  const month=new Date().toLocaleString('en-US',{month:'long'}).toUpperCase();
  document.querySelectorAll('*').forEach(el=>{
    if(el.children.length) return;
    const t=(el.textContent||'').trim().toUpperCase();
    if(t==='TOTAL SAVINGS') el.textContent='TOTAL SAVINGS - '+month;
    if(t==='NUMBER OF SHARES') el.textContent='NUMBER OF SHARES - '+month;
  });
}
new MutationObserver(()=>tmcsCurrentMonthLabels()).observe(document.body,{childList:true,subtree:true});
setTimeout(tmcsCurrentMonthLabels,0);
`;
}
fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 39 current-month dashboard labels applied.');
