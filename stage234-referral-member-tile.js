// Stage 234: referral bonus Regular member tile.
const fs=require('fs');
const p='www/app.js'; let app=fs.readFileSync(p,'utf8');
const anchor="    ['ADVANCE SAVING', 'Open advance savings payment form'],";
if(!app.includes(anchor))throw Error('Regular dashboard ADVANCE SAVING marker missing.');
if(!app.includes("['REFERRAL BONUS', 'View referral bonus balance']")){
  app=app.replace(anchor,anchor+"\n    ['REFERRAL BONUS', 'View referral bonus balance'],");
}
const actionAnchor="    if (user.role === 'regular' && title === 'BALANCES') {";
if(!app.includes(actionAnchor))throw Error('Regular dashboard BALANCES handler missing.');
if(!app.includes("title === 'REFERRAL BONUS'")){
  const action="    if (user.role === 'regular' && title === 'REFERRAL BONUS') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); const showBonus=async()=>{try{const result=await api('/api/account/referral-bonus',{cache:'no-store'}); alert('REFERRAL BONUS\\n'+naira(Number(result.balance||0))+'\\nSuccessful referrals: '+Number(result.referredMembers||0));}catch(err){alert(err?.message||'Unable to load referral bonus.');}}; card.addEventListener('click',showBonus); card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showBonus();}}); }\n";
  app=app.replace(actionAnchor,action+actionAnchor);
}
fs.writeFileSync(p,app);
console.log('Stage 234 Regular member referral bonus tile added with live balance lookup.');
