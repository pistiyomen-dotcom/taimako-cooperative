const fs=require('fs');
let s=fs.readFileSync('www/cash-credit.js','utf8');

s=s.replace("    let mode='regular';","    let mode='regular';\n    let confirmedUsername='';");
s=s.replace("      result.textContent='';\n      if(error) error.textContent='';","      confirmedUsername='';\n      result.textContent='';\n      if(error) error.textContent='';");
s=s.replace("      result.textContent=u ? 'Username: '+u : '';\n      result.style.display='block';","      confirmedUsername='';\n      result.textContent=u ? 'Username: '+u : '';\n      result.style.display='block';");
s=s.replace("        result.textContent=(data.account?.name || data.account?.full_name || 'Member')+' — '+(data.account?.username || u);","        confirmedUsername=u;\n        result.textContent=(data.account?.name || data.account?.full_name || 'Member')+' — '+(data.account?.username || u);");

const old="    select('regular');";
const add=`    const form=document.getElementById('cashCreditForm');
    const amountInput=document.getElementById('creditAmount');

    if(form && amountInput){
      form.addEventListener('submit',async(e)=>{
        e.preventDefault();
        e.stopImmediatePropagation();

        const u=username.value.trim().toUpperCase();
        const amount=Number(amountInput.value);
        const dest=destination.value;

        if(error) error.textContent='';
        if(success) success.textContent='';

        if(!u){ if(error) error.textContent='Enter a member username.'; return; }
        if(confirmedUsername!==u){ if(error) error.textContent='Confirm the member before posting cash.'; return; }
        if(!Number.isFinite(amount) || amount<=0){ if(error) error.textContent='Enter an amount greater than zero.'; return; }

        try{
          const session=getSession();
          const headers={'Content-Type':'application/json'};
          if(session.token) headers.Authorization='Bearer '+session.token;

          const response=await fetch('/api/admin/cash-credit',{
            method:'POST',
            headers,
            cache:'no-store',
            body:JSON.stringify({username:u,destination:dest,amount})
          });
          let posted={};
          try{ posted=await response.json(); }catch(_){}
          if(!response.ok) throw new Error(posted.error || 'Cash posting failed ('+response.status+').');

          const fresh=await cashApi('/api/admin/members/search?username='+encodeURIComponent(u));
          const keyMap={REGISTRATION:'registration',REGULAR:'regular',TARGET:'target',CONSTANT:'constant',WELFARE:'welfare',FLEXIBLE:'flexible',LOAN:'loanPrincipal',INTEREST:'loanInterest'};
          const key=keyMap[dest];
          const newBalance=Number(fresh.balances?.[key] ?? posted.balances?.[key] ?? 0);
          if(success) success.textContent='POSTED SUCCESSFULLY — '+dest+' BALANCE: ₦'+newBalance.toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
          result.textContent=(fresh.account?.name || fresh.account?.full_name || 'Member')+' — '+(fresh.account?.username || u);
          amountInput.value='';
        }catch(err){
          if(error) error.textContent=err.message;
        }
      },true);
    }

    select('regular');`;
s=s.replace(old,add);
fs.writeFileSync('www/cash-credit.js',s);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/cash-credit\\.js\\?v=\\d+/g,'cash-credit.js?v=64');
html=html.replace(/dashboard-refresh\\.js\\?v=\\d+/g,'dashboard-refresh.js?v=64');
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=64');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v64';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 64 verified cash posting applied.');