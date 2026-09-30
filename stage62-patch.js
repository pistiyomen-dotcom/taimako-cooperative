const fs=require('fs');

const cashScript=`(() => {
  function getSession(){
    try { return JSON.parse(sessionStorage.getItem('tmcs-session') || '{}'); }
    catch(_){ return {}; }
  }

  async function cashApi(path){
    const session=getSession();
    const headers={};
    if(session.token) headers.Authorization='Bearer '+session.token;
    const response=await fetch(path,{headers,cache:'no-store'});
    let body={};
    try{ body=await response.json(); }catch(_){}
    if(!response.ok) throw new Error(body.error || 'Request failed ('+response.status+').');
    return body;
  }

  function initCashCredit(){
    const regular=document.getElementById('cashCreditRegularTab');
    const flexible=document.getElementById('cashCreditFlexibleTab');
    const username=document.getElementById('creditUsername');
    const confirm=document.getElementById('confirmCreditMember');
    const result=document.getElementById('creditMemberConfirm');
    const error=document.getElementById('cashCreditError');
    const success=document.getElementById('cashCreditSuccess');
    const destination=document.getElementById('creditDestination');
    if(!regular || !flexible || !username || !confirm || !result || !destination) return;

    let mode='regular';

    function select(next){
      mode=next;
      regular.style.background=next==='regular'?'#d5a10b':'#fff';
      flexible.style.background=next==='flexible'?'#d5a10b':'#fff';
      regular.setAttribute('aria-pressed', next==='regular'?'true':'false');
      flexible.setAttribute('aria-pressed', next==='flexible'?'true':'false');
      if(next==='flexible'){
        destination.value='FLEXIBLE';
        destination.disabled=true;
      }else{
        destination.disabled=false;
        if(destination.value==='FLEXIBLE') destination.value='REGULAR';
      }
      result.textContent='';
      if(error) error.textContent='';
      if(success) success.textContent='';
    }

    regular.onclick=(e)=>{e.preventDefault();e.stopPropagation();select('regular');};
    flexible.onclick=(e)=>{e.preventDefault();e.stopPropagation();select('flexible');};

    username.oninput=()=>{
      const u=username.value.trim().toUpperCase();
      result.textContent=u ? 'Username: '+u : '';
      result.style.display='block';
      if(error) error.textContent='';
    };

    confirm.onclick=async(e)=>{
      e.preventDefault();e.stopPropagation();
      const u=username.value.trim().toUpperCase();
      if(error) error.textContent='';
      if(success) success.textContent='';
      if(!u){ result.textContent=''; if(error) error.textContent='Enter a member username.'; return; }
      result.style.display='block';
      result.textContent='Username: '+u+' — loading member...';
      try{
        const data=await cashApi('/api/admin/members/search?username='+encodeURIComponent(u));
        const role=String(data.account?.role || '').toLowerCase();
        if(role==='admin') throw new Error('Cash credit cannot be posted to an administrator account.');
        if(mode==='regular' && role!=='regular') throw new Error('This is not a Regular member account. Select FLEXIBLE for a Flexible saver.');
        if(mode==='flexible' && role!=='flexible') throw new Error('This is not a Flexible saver account. Select REGULAR for a Regular member.');
        result.textContent=(data.account?.name || data.account?.full_name || 'Member')+' — '+(data.account?.username || u);
      }catch(err){
        result.textContent='Username: '+u;
        if(error) error.textContent=err.message;
      }
    };

    select('regular');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initCashCredit);
  else initCashCredit();
})();`;

fs.writeFileSync('www/cash-credit.js',cashScript);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/<script src="app\.js\?v=\d+"><\/script>/,
  '<script src="app.js?v=62"></script>\n  <script src="cash-credit.js?v=62"></script>');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v62';");
sw=sw.replace("'./manifest.webmanifest'","'./manifest.webmanifest','./cash-credit.js'");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 62 standalone Manual Cash Credit controls applied.');
