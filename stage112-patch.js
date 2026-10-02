const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');

html=html.replace(
  '<button type="button" class="secondary" onclick="return window.confirmResetCredentialAccountV111()">CONFIRM</button>',
  '<button type="button" class="form-secondary reset-confirm-btn" id="resetCredentialConfirmBtn" onclick="return window.confirmResetCredentialAccountV111()">CONFIRM</button>'
);

html=html.replace(
  '<button type="button" class="secondary" onclick="return window.confirmDeleteAccountV111()">CONFIRM</button>',
  '<button type="button" class="form-secondary reset-confirm-btn" id="deleteAccountConfirmBtn" onclick="return window.confirmDeleteAccountV111()">CONFIRM</button>'
);

html=html.replace(/app\.js\?v=\d+/g,'app.js?v=112');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=112');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=112');
fs.writeFileSync('www/index.html',html);

let css=fs.readFileSync('www/styles.css','utf8');
if(!css.includes('.reset-confirm-btn')){
  css+=`
.reset-confirm-btn {
  width:100%;
  margin-top:12px;
  min-height:48px;
  color:var(--green-dark) !important;
  border:1px solid #b7c9bd !important;
  background:#fff !important;
  font-weight:900;
  border-radius:10px;
  cursor:pointer;
}
.reset-confirm-btn:active { transform:translateY(1px); }
#adminResetDialog input:disabled {
  background:#f3f4f6;
  color:#64748b;
  opacity:1;
}
`;
}
fs.writeFileSync('www/styles.css',css);

let app=fs.readFileSync('www/app.js','utf8');

// Make confirmation feedback explicit and keep input available on mobile after a successful lookup.
app=app.replace(
  "if(temp){\n      temp.disabled=false;",
  "if(temp){\n      temp.disabled=false;\n      temp.readOnly=false;"
);

app=app.replace(
  "if(temp){temp.value='';temp.disabled=true;}",
  "if(temp){temp.value='';temp.disabled=true;temp.readOnly=true;}"
);

app=app.replace(
  "box.textContent=data.account.name+' - '+data.account.username+' ('+String(data.account.role).toUpperCase()+')';",
  "box.textContent='CONFIRMED: '+data.account.name+' - '+data.account.username+' ('+String(data.account.role).toUpperCase()+')';"
);

app=app.replace(
  "box.textContent=data.account.name+' - '+data.account.username+' ('+String(data.account.role).toUpperCase()+')';\n    box.classList.add('show');\n    if(btn)btn.disabled=false;",
  "box.textContent='CONFIRMED: '+data.account.name+' - '+data.account.username+' ('+String(data.account.role).toUpperCase()+')';\n    box.classList.add('show');\n    if(btn)btn.disabled=false;"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=112'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v112';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 112 RESET confirm buttons and field unlock fixed.');