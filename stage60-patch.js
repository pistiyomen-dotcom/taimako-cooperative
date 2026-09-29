const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  /<div class="dialog-actions cash-credit-tabs"[^>]*><button type="button" id="cashCreditRegularTab"[^>]*>REGULAR<\/button><button type="button" id="cashCreditFlexibleTab"[^>]*>FLEXIBLE<\/button><\/div>/,
  '<div class="cash-credit-tabs" style="display:flex!important;gap:8px!important;width:100%!important;overflow:visible!important;margin:6px 0 12px!important"><button type="button" id="cashCreditRegularTab" class="primary" style="display:block!important;visibility:visible!important;opacity:1!important;flex:1 1 0!important;width:0!important;min-width:0!important">REGULAR</button><button type="button" id="cashCreditFlexibleTab" class="secondary" style="display:block!important;visibility:visible!important;opacity:1!important;flex:1 1 0!important;width:0!important;min-width:0!important">FLEXIBLE</button></div>'
);
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=60');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=60');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
  "document.getElementById('confirmCreditMember').addEventListener('click', async () => {\n  cashCreditError.textContent=''; cashCreditSuccess.textContent=''; creditMemberConfirm.className='member-confirm';\n  try {",
  "document.getElementById('confirmCreditMember').addEventListener('click', async () => {\n  cashCreditError.textContent=''; cashCreditSuccess.textContent='';\n  const enteredUsername=document.getElementById('creditUsername').value.trim().toUpperCase();\n  creditMemberConfirm.textContent=enteredUsername ? 'Username: '+enteredUsername+' — loading member...' : '';\n  creditMemberConfirm.className=enteredUsername ? 'member-confirm show' : 'member-confirm';\n  if(!enteredUsername){ cashCreditError.textContent='Enter a member username.'; return; }\n  try {"
);
app=app.replace(
  "const data=await api(`/api/admin/members/search?username=${encodeURIComponent(document.getElementById('creditUsername').value)}`);",
  "const data=await api(`/api/admin/members/search?username=${encodeURIComponent(enteredUsername)}`);"
);
app=app.replace(
  "creditMemberConfirm.textContent=data.account.name+' ('+data.account.username+')';",
  "creditMemberConfirm.textContent=data.account.name+' — '+data.account.username;"
);
app=app.replace(
  "} catch(error) { cashCreditError.textContent=error.message; }\n});",
  "} catch(error) { creditMemberConfirm.textContent='Username: '+enteredUsername; creditMemberConfirm.className='member-confirm show'; cashCreditError.textContent=error.message; }\n});",
  1
);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=60'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v60';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 60 cash selector and member confirmation fix applied.');
