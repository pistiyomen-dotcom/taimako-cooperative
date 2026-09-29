const fs=require('fs');

let h=fs.readFileSync('www/index.html','utf8');
if(!h.includes('id="createRegularTab"')){
  h=h.replace(
    '<div class="dialog-head"><h3>Create Account</h3><button type="button" class="icon-btn" data-close="createAccountDialog" aria-label="Close">×</button></div>',
    '<div class="dialog-head"><h3>Create Account</h3><button type="button" class="icon-btn" data-close="createAccountDialog" aria-label="Close">×</button></div><div class="dialog-actions create-account-tabs"><button type="button" id="createRegularTab" class="primary">REGULAR</button><button type="button" id="createFlexibleTab" class="secondary">FLEXIBLE</button></div>'
  );
}
fs.writeFileSync('www/index.html',h);

let s=fs.readFileSync('www/app.js','utf8');
if(!s.includes('function setCreateAccountType(role)')){
  s += [
    '',
    'function setCreateAccountType(role){',
    '  newRole.value=role;',
    '  const regular=document.getElementById(\'createRegularTab\');',
    '  const flexible=document.getElementById(\'createFlexibleTab\');',
    '  regular.className=role===\'regular\'?\'primary\':\'secondary\';',
    '  flexible.className=role===\'flexible\'?\'primary\':\'secondary\';',
    '  updateAccountHints();',
    '}',
    'document.getElementById(\'createRegularTab\').addEventListener(\'click\',()=>setCreateAccountType(\'regular\'));',
    'document.getElementById(\'createFlexibleTab\').addEventListener(\'click\',()=>setCreateAccountType(\'flexible\'));',
    'newRole.addEventListener(\'change\',()=>{',
    '  const regular=document.getElementById(\'createRegularTab\');',
    '  const flexible=document.getElementById(\'createFlexibleTab\');',
    '  regular.className=newRole.value===\'regular\'?\'primary\':\'secondary\';',
    '  flexible.className=newRole.value===\'flexible\'?\'primary\':\'secondary\';',
    '});',
    ''
  ].join('\n');
}

const openMarker="if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; updateAccountHints(); openDialog(createAccountDialog); }";
if(s.includes(openMarker) && !s.includes("setCreateAccountType('regular'); openDialog(createAccountDialog)")){
  s=s.replace(openMarker,"if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; setCreateAccountType('regular'); openDialog(createAccountDialog); }");
}

fs.writeFileSync('www/app.js',s);

let c=fs.readFileSync('www/styles.css','utf8');
if(!c.includes('tmcs-create-account-tabs-stage42')){
  c += '\n/* tmcs-create-account-tabs-stage42 */\n.create-account-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 12px;}\n.create-account-tabs button{width:100%;}\n';
}
fs.writeFileSync('www/styles.css',c);

console.log('TAIMAKO Stage 42 Create Account Regular Flexible tabs applied.');