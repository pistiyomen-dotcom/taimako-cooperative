const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

if(!account.includes('savingsTypeBreakdownV169')){
  const settingsMarker="  const cooperativeSettingsResult=await pool.query(\"SELECT setting_key,numeric_value FROM cooperative_settings WHERE setting_key IN ('minimum_share_per_month','total_registration_fee')\");";
  const monthlyBlock=[
    "  const savingsTypeMonthlyResult = await pool.query(",
    "    \"SELECT destination, \" +",
    "    \"COALESCE(SUM(CASE WHEN COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_DATE) AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_DATE)+INTERVAL '1 month' THEN amount ELSE 0 END),0) AS current_total, \" +",
    "    \"COALESCE(SUM(CASE WHEN COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_DATE-INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_DATE) THEN amount ELSE 0 END),0) AS previous_total \" +",
    "    \"FROM transactions WHERE account_id=$1 AND status IN ('approved','completed') \" +",
    "    \"AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') \" +",
    "    \"AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') \" +",
    "    \"AND COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_DATE-INTERVAL '1 month') \" +",
    "    \"AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_DATE)+INTERVAL '1 month' GROUP BY destination\",",
    "    [req.auth.sub]",
    "  );",
    "  const savingsTypeMonthlyMap=Object.fromEntries(savingsTypeMonthlyResult.rows.map(r=>[r.destination,{current:money(r.current_total),previous:money(r.previous_total)}]));",
    "  const previousMonthDividendResult=await pool.query(",
    "    \"SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE account_id=$1 AND status IN ('approved','completed') AND transaction_type='dividend_credit' AND destination='DIVIDEND' AND note = 'Monthly dividend for ' || to_char(date_trunc('month',CURRENT_DATE-INTERVAL '1 month'),'YYYY-MM')\",",
    "    [req.auth.sub]",
    "  );",
    "  const previousMonthDividendTotal=money(previousMonthDividendResult.rows[0]?.total);",
    ""
  ].join('\n');
  if(!account.includes(settingsMarker)){console.error('Stage 169 settings marker missing');process.exit(1);}
  account=account.replace(settingsMarker,monthlyBlock+settingsMarker);

  const minMarker="  const minimumSharePerMonth=cooperativeSettings.minimum_share_per_month>0 ? cooperativeSettings.minimum_share_per_month : 5000;";
  const breakdown=[
    "",
    "  const savingsTypeBreakdownV169={};",
    "  const typeBalanceMap={REGULAR:money(row.regular),TARGET:money(row.target),CONSTANT:money(row.constant),WELFARE:money(row.welfare)};",
    "  const previousSharesByType={};",
    "  let totalPreviousSharesForMember=0;",
    "  for(const type of ['REGULAR','TARGET','CONSTANT','WELFARE']){",
    "    const monthly=savingsTypeMonthlyMap[type]||{current:0,previous:0};",
    "    const previousShares=minimumSharePerMonth>0?Math.floor(monthly.previous/minimumSharePerMonth):0;",
    "    previousSharesByType[type]=previousShares;",
    "    totalPreviousSharesForMember+=previousShares;",
    "  }",
    "  for(const type of ['REGULAR','TARGET','CONSTANT','WELFARE']){",
    "    const monthly=savingsTypeMonthlyMap[type]||{current:0,previous:0};",
    "    const currentShares=minimumSharePerMonth>0?Math.floor(monthly.current/minimumSharePerMonth):0;",
    "    const previousDividend=totalPreviousSharesForMember>0 ? Number((previousMonthDividendTotal*(previousSharesByType[type]/totalPreviousSharesForMember)).toFixed(2)) : 0;",
    "    savingsTypeBreakdownV169[type]={currentMonthSavings:monthly.current,numberOfShares:currentShares,previousMonthSavings:monthly.previous,previousMonthDividend:previousDividend,totalBalance:typeBalanceMap[type]||0};",
    "  }",
    ""
  ].join('\n');
  if(!account.includes(minMarker)){console.error('Stage 169 minimum share marker missing');process.exit(1);}
  account=account.replace(minMarker,minMarker+breakdown);

  const respMarker="previousMonthSavings, previousMonthMemberShares: minimumSharePerMonth>0?Math.floor(previousMonthSavings/minimumSharePerMonth):0, minimumSharePerMonth,";
  if(!account.includes(respMarker)){console.error('Stage 169 response marker missing');process.exit(1);}
  account=account.replace(respMarker,"previousMonthSavings, previousMonthMemberShares: minimumSharePerMonth>0?Math.floor(previousMonthSavings/minimumSharePerMonth):0, savingsTypeBreakdown: savingsTypeBreakdownV169, minimumSharePerMonth,");
}
fs.writeFileSync('server/routes/account.js',account);

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="memberSavingTypeDialogV169"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog='\n  <dialog id="memberSavingTypeDialogV169" class="wide-dialog">\n    <div class="dialog-card">\n      <div class="dialog-head"><h3 id="memberSavingTypeTitleV169">SAVINGS</h3><button type="button" class="icon-btn" data-close="memberSavingTypeDialogV169" aria-label="Close">×</button></div>\n      <div id="memberSavingTypeGridV169" class="dashboard-grid"></div>\n    </div>\n  </dialog>\n\n';
  if(!html.includes(marker)){console.error('Stage 169 savings detail dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=169');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=169');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=169');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes('function openSavingTypeV169')){
  const marker='function renderDashboard() {';
  const fn=[
    "function openSavingTypeV169(type){",
    "  const b=state.balances||{};",
    "  const data=(b.savingsTypeBreakdown||{})[type]||{};",
    "  const current=tmcsMonthName(0).slice(0,3);",
    "  const previous=tmcsMonthName(-1).slice(0,4);",
    "  const items=[[current+' SAVINGS',naira(data.currentMonthSavings||0)],['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],[previous+' SAVINGS',naira(data.previousMonthSavings||0)],[previous+' DIVIDEND',naira(data.previousMonthDividend||0)],['TOTAL BALANCE',naira(data.totalBalance||0)]];",
    "  const title=document.getElementById('memberSavingTypeTitleV169');",
    "  const grid=document.getElementById('memberSavingTypeGridV169');",
    "  if(!grid) return;",
    "  if(title) title.textContent=type;",
    "  grid.innerHTML='';",
    "  items.forEach(([label,value])=>{const card=document.createElement('article');card.className='dashboard-card';const h=document.createElement('h4');h.textContent=label;const p=document.createElement('p');p.textContent=value;card.append(h,p);grid.appendChild(card);});",
    "  openDialog(document.getElementById('memberSavingTypeDialogV169'));",
    "}",
    "",
  ].join('\n');
  if(!app.includes(marker)){console.error('Stage 169 renderDashboard marker missing');process.exit(1);}
  app=app.replace(marker,fn+marker);
}

if(!app.includes("['REGULAR','TARGET','CONSTANT','WELFARE'].includes(title)")){
  const marker="if (user.role === 'regular' && title === 'BALANCES') { card.classList.add('admin-action-card');";
  const i=app.indexOf(marker);
  if(i<0){console.error('Stage 169 BALANCES action marker missing');process.exit(1);}
  const lineEnd=app.indexOf('\n',i);
  const line=app.slice(i,lineEnd);
  const action="if (user.role === 'regular' && ['REGULAR','TARGET','CONSTANT','WELFARE'].includes(title)) { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', () => openSavingTypeV169(title)); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openSavingTypeV169(title); }); }";
  app=app.replace(line,action+'\n    '+line);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=169'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v169';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 169 savings-type action calendars applied.');