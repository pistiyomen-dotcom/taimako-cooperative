const fs=require('fs');

let index=fs.readFileSync('server/index.js','utf8');
if(!index.includes("/api/public/bank-details")){
  const marker="  app.listen(port, () => console.log(\`TAIMAKO server listening on port \${port}\`));";
  const route=`
  app.get('/api/public/bank-details', (_req,res)=>{
    res.json({
      accountNumber:String(process.env.OFFICIAL_BANK_ACCOUNT_NUMBER||''),
      bankName:String(process.env.OFFICIAL_BANK_NAME||''),
      accountName:String(process.env.OFFICIAL_BANK_ACCOUNT_NAME||'')
    });
  });
`;
  if(!index.includes(marker)){console.error('Stage 113 server marker missing');process.exit(1);}
  index=index.replace(marker,route+'\n'+marker);
  fs.writeFileSync('server/index.js',index);
}

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=113');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=113');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=113');
fs.writeFileSync('www/index.html',html);

let css=fs.readFileSync('www/styles.css','utf8');
if(!css.includes('#officialBankAccountV113')){
  css+=`
#officialBankAccountV113{width:100%;box-sizing:border-box;text-align:center;margin:10px auto 18px;padding:14px 12px;border:1px solid #d7dfda;border-radius:12px;background:#fff}
#officialBankAccountV113 .bank-number-row{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;margin:0 0 7px}
#officialBankAccountV113 .bank-number{font-size:1.28rem;font-weight:900;letter-spacing:.035em}
#officialBankAccountV113 .bank-copy{width:auto;min-width:52px;min-height:30px;padding:5px 9px;border-radius:8px;border:1px solid #b8c7bd;background:#fff;font-size:.72rem;font-weight:900;cursor:pointer}
#officialBankAccountV113 .bank-name{margin:4px 0;font-weight:900;font-size:1rem}
#officialBankAccountV113 .bank-account-name{margin:4px auto 0;max-width:34rem;font-weight:800;line-height:1.35}
`;
}
fs.writeFileSync('www/styles.css',css);

let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes('installOfficialBankAccountV113')){
  app+=`
async function installOfficialBankAccountV113(){
  if(document.getElementById('officialBankAccountV113')) return;
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,.dialog-head,.form-title')];
  const title=headings.find(el=>/BANK\\s*TRANSFER/i.test(String(el.textContent||'')));
  let host=title?.closest('dialog,form,.dialog-card,.modal,.card,section')||null;
  if(!host){
    const dialogs=[...document.querySelectorAll('dialog')];
    host=dialogs.find(el=>/BANK\\s*TRANSFER/i.test(String(el.textContent||'')))||null;
  }
  if(!host) return;
  let details;
  try{
    const response=await fetch('/api/public/bank-details',{cache:'no-store'});
    if(!response.ok) return;
    details=await response.json();
  }catch(_){return;}
  if(!details.accountNumber||!details.bankName||!details.accountName) return;

  const panel=document.createElement('div');
  panel.id='officialBankAccountV113';
  panel.innerHTML='<div class="bank-number-row"><span class="bank-number"></span><button type="button" class="bank-copy">COPY</button></div><div class="bank-name"></div><div class="bank-account-name"></div>';
  panel.querySelector('.bank-number').textContent=details.accountNumber;
  panel.querySelector('.bank-name').textContent=details.bankName;
  panel.querySelector('.bank-account-name').textContent=details.accountName;
  const insertAfter=title&&host.contains(title)?title:host.querySelector('h1,h2,h3,h4,h5,.dialog-head');
  if(insertAfter) insertAfter.insertAdjacentElement('afterend',panel); else host.prepend(panel);

  panel.querySelector('.bank-copy').addEventListener('click',async function(){
    let copied=false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(details.accountNumber);copied=true;}}catch(_){}
    if(!copied){
      const ta=document.createElement('textarea');ta.value=details.accountNumber;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();try{copied=document.execCommand('copy');}catch(_){}ta.remove();
    }
    this.textContent=copied?'COPIED':'COPY';
    setTimeout(()=>{this.textContent='COPY';},1500);
  });
}
function normalizeBankApprovalButtonsV113(){
  const list=document.getElementById('approvalsList');
  if(!list) return;
  list.querySelectorAll('.reject-btn').forEach(btn=>{btn.textContent='DECLINE';btn.setAttribute('aria-label','Decline bank transfer payment');});
}
function startBankTransferV113(){
  installOfficialBankAccountV113();
  normalizeBankApprovalButtonsV113();
  const list=document.getElementById('approvalsList');
  if(list&&!list.dataset.v113Observed){list.dataset.v113Observed='1';new MutationObserver(normalizeBankApprovalButtonsV113).observe(list,{childList:true,subtree:true});}
  document.addEventListener('click',()=>setTimeout(()=>{installOfficialBankAccountV113();normalizeBankApprovalButtonsV113();},0),{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBankTransferV113);else startBankTransferV113();
`;
}
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=113'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v113';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 113 bank transfer form update applied.');
