const fs=require('fs');

// Stage 69: make Confirm visible, enforce username formats, and unlock Account Type after confirmation.

let html=fs.readFileSync('www/index.html','utf8');

html=html.replace(
  /<input id="cashCreditUsername"[^>]*>/,
  '<input id="cashCreditUsername" placeholder="ENTER USERNAME" autocomplete="off" required style="text-transform:uppercase" />'
);

html=html.replace(
  /<button type="button" class="secondary" id="cashCreditConfirm"[^>]*>CONFIRM<\/button>/,
  '<button type="button" class="primary" id="cashCreditConfirm" style="display:inline-flex!important;visibility:visible!important;opacity:1!important;width:auto!important;min-width:120px!important;align-items:center!important;justify-content:center!important;margin:8px 0 10px!important">CONFIRM</button>'
);

html=html.replace(
  /<select id="cashCreditDestination" required disabled>/,
  '<select id="cashCreditDestination" required disabled aria-disabled="true">'
);

html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=69');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=69');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=69');
fs.writeFileSync('www/index.html',html);

let cash=fs.readFileSync('www/cash-credit-v66.js','utf8');

// Inject account-specific username formatting helper.
if(!cash.includes('function configureUsernameField()')){
  cash=cash.replace(
    "  function clearConfirmation(){",
`  function configureUsernameField(){
    const x=e();
    if(!x.account||!x.username)return;
    const type=(x.account.value||'').toUpperCase();

    x.username.value='';
    x.username.removeAttribute('pattern');
    x.username.removeAttribute('maxlength');
    x.username.removeAttribute('inputmode');

    if(type==='REGULAR'){
      x.username.maxLength=5;
      x.username.inputMode='numeric';
      x.username.pattern='[0-9]{5}';
      x.username.placeholder='ENTER 5-DIGIT USERNAME';
    }else if(type==='FLEXIBLE'){
      x.username.maxLength=4;
      x.username.inputMode='text';
      x.username.pattern='F[0-9]{3}';
      x.username.value='F';
      x.username.placeholder='F + 3 DIGITS';
    }else if(type==='ADMIN'){
      x.username.maxLength=20;
      x.username.inputMode='text';
      x.username.pattern='[A-Za-z0-9_-]{3,20}';
      x.username.placeholder='ENTER ADMIN USERNAME';
    }else{
      x.username.maxLength=20;
      x.username.placeholder='ENTER USERNAME';
    }
  }

  function normalizeUsernameInput(){
    const x=e();
    if(!x.account||!x.username)return;
    const type=(x.account.value||'').toUpperCase();

    if(type==='REGULAR'){
      x.username.value=x.username.value.replace(/\\D/g,'').slice(0,5);
    }else if(type==='FLEXIBLE'){
      const digits=x.username.value.toUpperCase().replace(/^F/,'').replace(/\\D/g,'').slice(0,3);
      x.username.value='F'+digits;
    }else{
      x.username.value=x.username.value.toUpperCase().slice(0,20);
    }
  }

  function validUsernameForAccount(type,username){
    if(type==='REGULAR') return /^\\d{5}$/.test(username);
    if(type==='FLEXIBLE') return /^F\\d{3}$/.test(username);
    if(type==='ADMIN') return /^[A-Z0-9_-]{3,20}$/.test(username);
    return false;
  }

  function clearConfirmation(){`
  );
}

// Add validation before API confirmation.
cash=cash.replace(
  "    if(!account){x.error.textContent='Select an Account.';return;}\n    if(!username){x.error.textContent='Enter username.';return;}",
  "    if(!account){x.error.textContent='Select an Account.';return;}\n    if(!username){x.error.textContent='Enter username.';return;}\n    if(!validUsernameForAccount(account,username)){\n      x.error.textContent=account==='REGULAR'?'Regular username must be exactly 5 digits.':account==='FLEXIBLE'?'Flexible username must be F followed by exactly 3 digits.':'Enter a valid Admin username.';\n      return;\n    }"
);

// Make Account Type explicitly active after successful confirmation.
cash=cash.replace(
  "      x.destination.disabled=false;",
  "      x.destination.disabled=false;\n      x.destination.removeAttribute('aria-disabled');\n      x.destination.focus();"
);

// Ensure clear confirmation disables it again.
cash=cash.replace(
  "    if(x.destination){x.destination.value='';x.destination.disabled=true;}",
  "    if(x.destination){x.destination.value='';x.destination.disabled=true;x.destination.setAttribute('aria-disabled','true');}"
);

// Replace listeners with account-aware formatting.
cash=cash.replace(
  "    x.account.addEventListener('change',clearConfirmation);\n    x.username.addEventListener('input',()=>{\n      x.username.value=x.username.value.toUpperCase();\n      clearConfirmation();\n    });",
  "    x.account.addEventListener('change',()=>{ clearConfirmation(); configureUsernameField(); });\n    x.username.addEventListener('input',()=>{ normalizeUsernameInput(); clearConfirmation(); });\n    configureUsernameField();"
);

// Validate again before posting.
cash=cash.replace(
  "    if(!username){x.error.textContent='Enter username.';return;}\n    if(state.confirmedUsername!==username||state.confirmedAccount!==account){",
  "    if(!username){x.error.textContent='Enter username.';return;}\n    if(!validUsernameForAccount(account,username)){x.error.textContent='Username format does not match selected Account.';return;}\n    if(state.confirmedUsername!==username||state.confirmedAccount!==account){"
);

fs.writeFileSync('www/cash-credit-v66.js',cash);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=69'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v69';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 69 Cash Credit confirm visibility and username validation applied.');