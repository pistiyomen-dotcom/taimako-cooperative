'use strict';
// UI adapter for a staged, read-only assisted member view.
// Load only after authenticated admin login and an explicit member confirmation.
(function(global){
  const esc = (v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const money = v => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(Number(v||0));
  function createAssistedMemberView({root, apiBase='', getAdminToken, onClose=()=>{}}){
    if(!root || typeof getAdminToken!=='function') throw Error('View container and authentication required');
    let sessionToken=null;
    async function request(path, options={}){
      const response=await fetch(apiBase+'/api/admin/member-assistance'+path,{
        ...options,
        cache:'no-store',
        headers:{'Authorization':'Bearer '+getAdminToken(),
          ...(sessionToken?{'x-tmcs-assistance-token':sessionToken}:{}),
          ...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw Error(body.error||'Unable to complete request');
      return body;
    }
    function showError(err){const target=root.querySelector('[data-assist-error]');if(target)target.textContent=err.message||String(err);}
    async function open(username){
      root.innerHTML='<p>Opening assisted account...</p>';
      try{
        const started=await request('/start',{method:'POST',body:JSON.stringify({username,memberConfirmed:true})});
        sessionToken=started.token;
        await refresh();
      }catch(err){
        if(sessionToken){
          try{await request('/end',{method:'POST'});}catch(_){}
          sessionToken=null;
        }
        root.innerHTML='<p role="alert" data-assist-error></p>';
        showError(err);
      }
    }
    async function refresh(){
      const data=await request('/dashboard');
      const m=data.member||{},b=data.balance||{};
      const rows=(m.role==='flexible'
        ?[['FLEXIBLE',b.flexible]]
        :[['REGULAR',b.regular],['TARGET',b.target],['CONSTANT',b.constant],['WELFARE',b.welfare]]);
      root.innerHTML='<section aria-label="Assisted member account">'+
        '<h3>MEMBER ACCOUNT — ADMIN ASSISTANCE</h3>'+
        '<p><strong>'+esc(m.full_name)+' — '+esc(m.username)+'</strong> ('+esc(m.role).toUpperCase()+')</p>'+
        '<p>Administrator-assisted view. Financial actions are not yet enabled.</p>'+
        '<div class="mini-grid">'+rows.map(([name,value])=>'<div><span>'+esc(name)+'</span><b>'+esc(money(value))+'</b></div>').join('')+'</div>'+
        '<p>ACTIVE LOAN: '+esc(money(b.loan_principal))+' | INTEREST: '+esc(money(b.loan_interest))+'</p>'+
        '<p role="alert" data-assist-error></p>'+
        '<button type="button" data-assist-refresh>REFRESH</button> '+
        '<button type="button" data-assist-return>RETURN TO ADMIN</button></section>';
      root.querySelector('[data-assist-refresh]').addEventListener('click',()=>refresh().catch(showError));
      root.querySelector('[data-assist-return]').addEventListener('click',()=>close().catch(showError));
    }
    async function close(){
      try{if(sessionToken) await request('/end',{method:'POST'});}
      finally{sessionToken=null;root.innerHTML='';onClose();}
    }
    return {open,refresh,close};
  }
  global.createAssistedMemberView=createAssistedMemberView;
})(typeof window!=='undefined'?window:globalThis);
