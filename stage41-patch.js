const fs=require('fs');

let h=fs.readFileSync('www/index.html','utf8');
if(!h.includes('id="cashCreditRegularTab"')){
  h=h.replace(
    '<div class="dialog-head"><h3>Manual Cash Credit</h3><button type="button" class="icon-btn" data-close="cashCreditDialog" aria-label="Close">×</button></div>',
    '<div class="dialog-head"><h3>Manual Cash Credit</h3><button type="button" class="icon-btn" data-close="cashCreditDialog" aria-label="Close">×</button></div><div class="dialog-actions cash-credit-tabs"><button type="button" id="cashCreditRegularTab" class="primary">REGULAR</button><button type="button" id="cashCreditFlexibleTab" class="secondary">FLEXIBLE</button></div>'
  );
}
fs.writeFileSync('www/index.html',h);

let s=fs.readFileSync('www/app.js','utf8');
if(!s.includes("let cashCreditMode='regular';")){
  s=s.replace('function memberSummary(data) {',"let cashCreditMode='regular';\nfunction memberSummary(data) {");
}

if(!s.includes("<span>REGISTRATION</span><b>${naira(b.registration)}</b>")){
  const re=/function memberSummary\(data\) \{[\s\S]*?\n\}/m;
  if(!re.test(s)){console.error('Stage 41 memberSummary target not found');process.exit(1);}
  const repl=[
    'function memberSummary(data) {',
    '  const a=data.account, b=data.balances;',
    '  return `<div class="search-summary"><div class="identity"><strong>${escapeHTML(a.name)}</strong><span>${escapeHTML(a.username)} • ${escapeHTML(roleLabel(a.role))}</span></div><div class="mini-grid">',
    '    <div><span>REGISTRATION</span><b>${naira(b.registration)}</b></div><div><span>REGULAR</span><b>${naira(b.regular)}</b></div>',
    '    <div><span>TARGET</span><b>${naira(b.target)}</b></div><div><span>CONSTANT</span><b>${naira(b.constant)}</b></div>',
    '    <div><span>WELFARE</span><b>${naira(b.welfare)}</b></div><div><span>FLEXIBLE</span><b>${naira(b.flexible)}</b></div>',
    '    <div><span>TOTAL SAVINGS</span><b>${naira(b.totalSavings)}</b></div><div><span>SHARES</span><b>${escapeHTML(b.numberOfShares)}</b></div>',
    '    <div><span>ACTIVE LOAN</span><b>${naira(b.loanPrincipal)}</b></div><div><span>LOAN INTEREST</span><b>${naira(b.loanInterest)}</b></div>',
    '    <div><span>DUE DATE</span><b>${escapeHTML(b.loanDueDate||\'—\')}</b></div>',
    '  </div></div>`;',
    '}'
  ].join('\n');
  s=s.replace(re,repl);
}

const confirmNeedle="if (data.account.role === 'admin') throw new Error('Cash credit cannot be posted to an administrator account.');";
if(s.includes(confirmNeedle) && !s.includes("cashCreditMode==='regular' && data.account.role!=='regular'")){
  s=s.replace(confirmNeedle,confirmNeedle+"\n    if (cashCreditMode==='regular' && data.account.role!=='regular') throw new Error('This is not a Regular member account. Select the FLEXIBLE tab for a Flexible saver.');\n    if (cashCreditMode==='flexible' && data.account.role!=='flexible') throw new Error('This is not a Flexible saver account. Select the REGULAR tab for a Regular member.');");
  s=s.replace("creditMemberConfirm.innerHTML=`<strong>${escapeHTML(data.account.name)}</strong><br>${escapeHTML(data.account.username)} • ${escapeHTML(roleLabel(data.account.role))}`;","creditMemberConfirm.innerHTML=memberSummary(data);");
}

if(!s.includes('function setCashCreditMode(mode)')){
  s += [
    '',
    'function setCashCreditMode(mode){',
    '  cashCreditMode=mode;',
    '  const regular=document.getElementById(\'cashCreditRegularTab\');',
    '  const flexible=document.getElementById(\'cashCreditFlexibleTab\');',
    '  const destination=document.getElementById(\'creditDestination\');',
    '  regular.className=mode===\'regular\'?\'primary\':\'secondary\';',
    '  flexible.className=mode===\'flexible\'?\'primary\':\'secondary\';',
    '  creditMemberConfirm.className=\'member-confirm\';',
    '  creditMemberConfirm.innerHTML=\'\';',
    '  cashCreditError.textContent=\'\'; cashCreditSuccess.textContent=\'\';',
    '  if(mode===\'flexible\'){ destination.value=\'FLEXIBLE\'; destination.disabled=true; } else { destination.disabled=false; }',
    '}',
    'document.getElementById(\'cashCreditRegularTab\').addEventListener(\'click\',()=>setCashCreditMode(\'regular\'));',
    'document.getElementById(\'cashCreditFlexibleTab\').addEventListener(\'click\',()=>setCashCreditMode(\'flexible\'));',
    'setCashCreditMode(\'regular\');',
    ''
  ].join('\n');
}

fs.writeFileSync('www/app.js',s);

let c=fs.readFileSync('www/styles.css','utf8');
if(!c.includes('tmcs-cash-credit-tabs-stage41')){
  c += '\n/* tmcs-cash-credit-tabs-stage41 */\n.cash-credit-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 12px;}\n.cash-credit-tabs button{width:100%;}\n#creditMemberConfirm .search-summary{margin-top:10px;}\n';
}
fs.writeFileSync('www/styles.css',c);

console.log('TAIMAKO Stage 41 cash credit tabs and full member confirmation applied.');