const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  /<div class="cash-credit-tabs"[\s\S]*?<\/div>/,
  '<div id="cashCreditTypeSelector" style="display:flex;gap:10px;width:100%;margin:8px 0 14px"><button type="button" id="cashCreditRegularTab" style="flex:1;padding:14px 8px;border:2px solid #d5a10b;border-radius:12px;background:#d5a10b;color:#17321f;font-weight:800">REGULAR</button><button type="button" id="cashCreditFlexibleTab" style="flex:1;padding:14px 8px;border:2px solid #d5a10b;border-radius:12px;background:#fff;color:#17321f;font-weight:800">FLEXIBLE</button></div>'
);
html=html.replace(
  '<div id="creditMemberConfirm" class="member-confirm"></div>',
  '<div id="creditMemberConfirm" class="member-confirm" style="display:block;min-height:28px;margin-top:8px;font-weight:700;color:#075d32"></div>'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=61');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=61');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
  /function setCashCreditMode\(mode\)\{[\s\S]*?\n\}/m,
  `function setCashCreditMode(mode){
  cashCreditMode=mode;
  const regular=document.getElementById('cashCreditRegularTab');
  const flexible=document.getElementById('cashCreditFlexibleTab');
  const destination=document.getElementById('creditDestination');
  regular.style.background=mode==='regular'?'#d5a10b':'#fff';
  flexible.style.background=mode==='flexible'?'#d5a10b':'#fff';
  creditMemberConfirm.textContent='';
  cashCreditError.textContent='';
  cashCreditSuccess.textContent='';
  if(mode==='flexible'){
    destination.value='FLEXIBLE';
    destination.disabled=true;
  }else{
    destination.disabled=false;
    if(destination.value==='FLEXIBLE') destination.value='REGULAR';
  }
}`
);

app=app.replace(
  "document.getElementById('creditUsername').addEventListener('input',()=>{ creditMemberConfirm.className='member-confirm'; creditMemberConfirm.textContent=''; cashCreditError.textContent=''; });",
  "document.getElementById('creditUsername').addEventListener('input',(e)=>{ const u=e.target.value.trim().toUpperCase(); creditMemberConfirm.textContent=u ? 'Username: '+u : ''; cashCreditError.textContent=''; });"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=61'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v61';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 61 independent Cash Credit selector applied.');
