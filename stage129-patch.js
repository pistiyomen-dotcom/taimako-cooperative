const fs=require('fs');

let server=fs.readFileSync('server/index.js','utf8');
const bankRoute=/\n\s*app\.get\('\/api\/public\/bank-details',[\s\S]*?\n\s*\}\);\n/;
const match=server.match(bankRoute);
if(!match){console.error('Stage 129 bank route not found');process.exit(1);}
const route=match[0];
server=server.replace(bankRoute,'\n');
const catchIndex=server.indexOf("app.get('*'");
if(catchIndex<0){console.error('Stage 129 catch-all not found');process.exit(1);}
server=server.slice(0,catchIndex)+route+'\n'+server.slice(catchIndex);
fs.writeFileSync('server/index.js',server);

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="bankTransferOfficialV129"')){
  const marker='<div class="dialog-head"><h3>Bank Transfer Payment</h3><button type="button" class="icon-btn" data-close="paymentDialog" aria-label="Close">×</button></div>';
  const panel='\n      <div id="bankTransferOfficialV129" style="text-align:center;padding:12px 10px;margin:8px 0 16px;border:1px solid #d8e0db;border-radius:12px;background:#fff">\n        <div style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap">\n          <strong id="bankTransferNumberV129" style="font-size:1.3rem">1027050172</strong>\n          <button type="button" id="bankTransferCopyV129" class="secondary" style="width:auto;padding:5px 9px;min-width:54px">COPY</button>\n        </div>\n        <div id="bankTransferBankV129" style="font-weight:900;margin-top:5px">FCMB</div>\n        <div id="bankTransferNameV129" style="font-weight:800;margin-top:4px;line-height:1.35">TAIMAKO MULTIPURPOSE COOPERATIVE SOCIETY LTD</div>\n      </div>\n';
  if(!html.includes(marker)){console.error('Stage 129 payment form marker not found');process.exit(1);}
  html=html.replace(marker,marker+panel);
}
if(!html.includes('bank-transfer-v129.js')){
  html=html.replace('</body>','  <script src="./bank-transfer-v129.js?v=129"></script>\n</body>');
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=129');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=129');
fs.writeFileSync('www/index.html',html);

const standalone=[
"(function(){",
"  const form=document.getElementById('paymentForm');",
"  if(!form) return;",
"  const error=document.getElementById('paymentError');",
"  const success=document.getElementById('paymentSuccess');",
"  const copy=document.getElementById('bankTransferCopyV129');",
"  copy?.addEventListener('click',async()=>{",
"    const value=document.getElementById('bankTransferNumberV129')?.textContent?.trim()||'';",
"    if(!value) return;",
"    let ok=false;",
"    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);ok=true;}}catch(_){}",
"    if(!ok){const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{ok=document.execCommand('copy');}catch(_){}ta.remove();}",
"    if(ok){copy.textContent='COPIED';setTimeout(()=>copy.textContent='COPY',1200);}",
"  });",
"  form.noValidate=true;",
"  document.addEventListener('submit',async function(e){",
"    if(e.target!==form) return;",
"    e.preventDefault();",
"    e.stopImmediatePropagation();",
"    const button=form.querySelector('button[type=\\\"submit\\\"]');",
"    const destination=document.getElementById('paymentDestination');",
"    const amount=document.getElementById('paymentAmount');",
"    const receiptInput=document.getElementById('paymentReceipt');",
"    const note=document.getElementById('paymentNote');",
"    if(error) error.textContent='';",
"    if(success) success.textContent='Processing bank-transfer submission…';",
"    const old=button?.textContent||'SUBMIT FOR APPROVAL';",
"    try{",
"      if(button){button.disabled=true;button.textContent='SUBMITTING…';}",
"      const receipt=receiptInput?.files?.[0];",
"      if(!destination?.value) throw new Error('Select a payment destination.');",
"      if(!Number(amount?.value)||Number(amount.value)<=0) throw new Error('Enter an amount greater than zero.');",
"      if(!receipt) throw new Error('Upload the bank-transfer receipt.');",
"      const data=new FormData();",
"      data.append('destination',destination.value);",
"      data.append('amount',amount.value);",
"      data.append('note',note?.value||'');",
"      data.append('receipt',receipt);",
"      if(typeof state==='undefined'||!state.token) throw new Error('Your login session has expired. Please log in again.');",
"      const response=await fetch((typeof API_BASE!=='undefined'?API_BASE:'')+'/api/account/payment-requests',{method:'POST',headers:{Authorization:'Bearer '+state.token},body:data,cache:'no-store'});",
"      let body={};try{body=await response.json();}catch(_){ }",
"      if(!response.ok) throw new Error(body.error||('Submission failed ('+response.status+').'));",
"      if(!body.request?.reference) throw new Error('The server did not confirm the payment request.');",
"      if(success) success.textContent='SUBMITTED SUCCESSFULLY • PENDING ADMIN APPROVAL • Ref: '+body.request.reference;",
"      amount.value='';if(note) note.value='';receiptInput.value='';",
"    }catch(err){",
"      if(success) success.textContent='';",
"      if(error) error.textContent=err?.message||'Unable to submit payment.';",
"    }finally{",
"      if(button){button.disabled=false;button.textContent=old;}",
"    }",
"  },true);",
"})();"
].join('\n');
fs.writeFileSync('www/bank-transfer-v129.js',standalone);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v129';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 129 direct bank panel, route order and standalone submit applied.');