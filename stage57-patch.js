const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  '<div class="dialog-actions cash-credit-tabs"><button type="button" id="cashCreditRegularTab" class="primary">REGULAR</button><button type="button" id="cashCreditFlexibleTab" class="secondary">FLEXIBLE</button></div>',
  '<div class="dialog-actions cash-credit-tabs" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%"><button type="button" id="cashCreditRegularTab" class="primary" style="width:100%">REGULAR</button><button type="button" id="cashCreditFlexibleTab" class="secondary" style="width:100%">FLEXIBLE</button></div>'
);
html=html.replace('<label>Note (optional)<input id="creditNote" /></label>','');
html=html.replace(
  '<button class="primary" type="submit">POST CASH CREDIT</button>',
  '<button class="primary" id="postCashButton" type="submit" style="width:auto;min-width:130px;max-width:180px;padding-left:18px;padding-right:18px">POST CASH</button>'
);
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
  "creditMemberConfirm.innerHTML=memberSummary(data);",
  "creditMemberConfirm.textContent=data.account.name+' ('+data.account.username+')';"
);

app=app.replace(
  "amount:document.getElementById('creditAmount').value,\n      note:document.getElementById('creditNote').value",
  "amount:document.getElementById('creditAmount').value"
);

app=app.replace(
  "document.getElementById('creditAmount').value=''; document.getElementById('creditNote').value='';",
  "document.getElementById('creditAmount').value='';"
);

const marker="document.getElementById('confirmCreditMember').addEventListener('click', async () => {";
if(app.includes(marker) && !app.includes("creditUsername').addEventListener('input'")){
  app=app.replace(
    marker,
    "document.getElementById('creditUsername').addEventListener('input',()=>{ creditMemberConfirm.className='member-confirm'; creditMemberConfirm.textContent=''; cashCreditError.textContent=''; });\n\n"+marker
  );
}

fs.writeFileSync('www/app.js',app);
console.log('TAIMAKO Stage 57 Manual Cash Credit form corrections applied.');
