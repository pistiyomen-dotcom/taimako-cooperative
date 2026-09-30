const fs=require('fs');

// Stage 74: account-specific Cash Credit destinations with backend enforcement.

let admin=fs.readFileSync('server/routes/admin.js','utf8');

admin=admin.replace(
  "  const allowedDestinations=['REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE','LOAN','INTEREST','REGISTRATION','MEMBERSHIP CARD','FLEXIBLE CARD','APPLICATION FORM'];",
  "  const allowedDestinationsByAccount={ADMIN:['APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD'],REGULAR:['REGULAR','TARGET','CONSTANT','WELFARE','LOAN','INTEREST','REGISTRATION'],FLEXIBLE:['FLEXIBLE']};\n  const allowedDestinations=allowedDestinationsByAccount[accountType]||[];"
);

admin=admin.replace(
  "  if(!allowedDestinations.includes(destination)) return res.status(400).json({error:'Select a valid Account Type.'});",
  "  if(!allowedDestinations.includes(destination)) return res.status(400).json({error:'Selected Account Type is not allowed for '+accountType+' account.'});"
);

fs.writeFileSync('server/routes/admin.js',admin);

let cash=fs.readFileSync('www/cash-credit-v66.js','utf8');

if(!cash.includes('function populateDestinationOptions')){
  cash=cash.replace(
    "  function clearConfirmation(){",
    `  function populateDestinationOptions(accountType){
    const x=e();
    if(!x.destination)return;
    const map={
      ADMIN:['APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD'],
      REGULAR:['REGULAR','TARGET','CONSTANT','WELFARE','LOAN','INTEREST','REGISTRATION'],
      FLEXIBLE:['FLEXIBLE']
    };
    const options=map[accountType]||[];
    x.destination.innerHTML='<option value="">-Select Account Type</option>'+options.map(v=>'<option value="'+v+'">'+v+'</option>').join('');
  }

  function clearConfirmation(){`
  );
}

cash=cash.replace(
  "    if(x.destination){x.destination.value='';x.destination.disabled=true;x.destination.setAttribute('aria-disabled','true');}",
  "    if(x.destination){populateDestinationOptions((x.account?.value||'').toUpperCase());x.destination.value='';x.destination.disabled=true;x.destination.setAttribute('aria-disabled','true');}"
);

cash=cash.replace(
  "      x.destination.disabled=false;\n      x.destination.removeAttribute('aria-disabled');\n      x.destination.focus();",
  "      populateDestinationOptions(account);\n      x.destination.disabled=false;\n      x.destination.removeAttribute('aria-disabled');\n      x.destination.focus();"
);

cash=cash.replace(
  "    x.account.addEventListener('change',()=>{ clearConfirmation(); configureUsernameField(); });",
  "    x.account.addEventListener('change',()=>{ populateDestinationOptions((x.account.value||'').toUpperCase()); clearConfirmation(); configureUsernameField(); });"
);

cash=cash.replace(
  "    configureUsernameField();",
  "    populateDestinationOptions((x.account.value||'').toUpperCase());\n    configureUsernameField();"
);

fs.writeFileSync('www/cash-credit-v66.js',cash);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=74');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=74');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=74');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=74'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v74';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 74 account-specific Cash Credit destinations applied.');