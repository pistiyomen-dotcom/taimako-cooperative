// Stage 234: display credited referral balance directly on Regular member tile.
const fs=require('fs');
const p='www/app.js';
let app=fs.readFileSync(p,'utf8');
const marker="    ['ADVANCE SAVING', 'Open advance savings payment form'],";
if(!app.includes(marker))throw Error('Regular dashboard anchor missing.');
if(!app.includes("['REFERRAL BONUS', '']")){
 app=app.replace(marker,marker+"\n    ['REFERRAL BONUS', ''],");
}
const anchor="    if (user.role === 'regular' && title === 'BALANCES') {";
if(!app.includes(anchor))throw Error('Regular dashboard action anchor missing.');
if(!app.includes('tmcsReferralBonusAmountV234')){
 const action="    if (user.role === 'regular' && title === 'REFERRAL BONUS') { const value=document.createElement('div'); value.className='tmcs-referral-bonus-amount-v234'; value.textContent=naira(0); card.appendChild(value); const refresh=async()=>{try{const data=await api('/api/account/referral-bonus',{cache:'no-store'});value.textContent=naira(Number(data.balance||0));}catch(err){value.textContent='Balance unavailable';}}; card.dataset.tmcsReferralBonusAmountV234='1'; refresh(); card.addEventListener('click',refresh); }\n";
 app=app.replace(anchor,action+anchor);
}
fs.writeFileSync(p,app);
console.log('REFERRAL BONUS tile now displays accrued bonus amount directly.');
