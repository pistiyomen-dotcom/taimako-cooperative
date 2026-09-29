const fs=require('fs');
const p='www/app.js';
let s=fs.readFileSync(p,'utf8');

if(!s.includes('data-public-action="flex-info"')){
  const old="'FLEXIBLE': `<h4>Flexible Savings</h4><p>Designed for petty traders, students and the general public. Save any amount on any day. No cooperative membership registration is required; the account can be created as a Flexible saver account.</p><p>Minimum savings duration is 30 days. Flexible savers are not entitled to cooperative dividend. After 30 days, one withdrawal is free in each 30-day window. Withdrawal before 30 days, or another withdrawal inside the same 30-day window, carries a 20% charge.</p><p>Flexible funds can also be transferred internally to a linked Regular account without using the withdrawal process.</p><p><button class=\"primary inline-action\" data-public-action=\"login\">LOGIN</button> <button class=\"secondary inline-action\" data-public-action=\"contact\">REGISTER</button></p>`,";
  const neu="'FLEXIBLE': `<p><button class=\"primary inline-action\" data-public-action=\"login\">LOGIN</button> <button class=\"secondary inline-action\" data-public-action=\"contact\">REGISTER</button> <button class=\"secondary inline-action\" data-public-action=\"flex-info\">FLEXIBLE INFO</button></p><div id=\"publicFlexibleInfo\" hidden><h4>Flexible Savings</h4><p>Designed for petty traders, students and the general public. Save any amount on any day. No cooperative membership registration is required; the account can be created as a Flexible saver account.</p><p>Minimum savings duration is 30 days. Flexible savers are not entitled to cooperative dividend. After 30 days, one withdrawal is free in each 30-day window. Withdrawal before 30 days, or another withdrawal inside the same 30-day window, carries a 20% charge.</p><p>Flexible funds can be transferred internally to the linked Regular member\'s REGULAR, TARGET, CONSTANT, WELFARE, LOAN, INTEREST or REGISTRATION destination.</p></div>`,";
  if(!s.includes(old)){console.error('Stage 49 Flexible public content marker missing');process.exit(1);}
  s=s.replace(old,neu);
}

if(!s.includes("btn.dataset.publicAction === 'flex-info'")){
  const oldHandler="    if (btn.dataset.publicAction === 'login') { loginForm.reset(); loginError.textContent=''; openDialog(loginDialog); }\n    else { contactForm.reset(); contactError.textContent=''; contactSuccess.textContent=''; openDialog(contactDialog); }";
  const newHandler="    if (btn.dataset.publicAction === 'login') { loginForm.reset(); loginError.textContent=''; openDialog(loginDialog); }\n    else if (btn.dataset.publicAction === 'flex-info') { serviceDialog.showModal?.(); const info=document.getElementById('publicFlexibleInfo'); if(info) info.hidden=false; }\n    else { contactForm.reset(); contactError.textContent=''; contactSuccess.textContent=''; openDialog(contactDialog); }";
  if(!s.includes(oldHandler)){console.error('Stage 49 public action handler marker missing');process.exit(1);}
  s=s.replace(oldHandler,newHandler);
}

fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 49 public Flexible actions applied.');