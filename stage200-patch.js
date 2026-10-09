const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');
let html=fs.readFileSync('www/index.html','utf8');

// Rewire the Admin dashboard MEMBER SEARCH action to the fresh dialog.
app=app.replace(
  "if (title === 'MEMBER SEARCH') { memberSearchForm.reset(); memberSearchError.textContent=''; memberSearchResult.innerHTML=''; openDialog(memberSearchDialog); }",
  "if (title === 'MEMBER SEARCH') { openMemberLookupFresh(); }"
);

// Remove the original MEMBER SEARCH submit handler.
app=app.replace(/memberSearchForm\.addEventListener\('submit',[\s\S]*?\n\}\);\n/,'');

// Remove the original MEMBER SEARCH dialog/form.
html=html.replace(/<dialog\b(?:(?!<\/dialog>)[\s\S])*?id=[\"']memberSearchForm[\"'](?:(?!<\/dialog>)[\s\S])*?<\/dialog>/i,'');

// Add a brand-new independent MEMBER SEARCH dialog.
if(!html.includes('id="memberLookupFreshDialog"')){
  const dialog=[
'  <dialog id="memberLookupFreshDialog" class="wide-dialog">',
'    <div class="dialog-card">',
'      <div class="dialog-head"><h3>MEMBER SEARCH</h3><button type="button" class="icon-btn" data-close="memberLookupFreshDialog" aria-label="Close">×</button></div>',
'      <p class="helper">Enter a Regular or Flexible username to view the member account details.</p>',
'      <label>Username<input id="memberLookupFreshUsername" maxlength="5" autocomplete="off" placeholder="Regular: up to 5 digits • Flexible: F + 3 digits" style="text-transform:uppercase" /></label>',
'      <div style="margin:10px 0 14px"><button type="button" class="primary" id="memberLookupFreshSearch" style="width:auto;min-width:120px">SEARCH</button></div>',
'      <p class="form-error" id="memberLookupFreshError"></p>',
'      <div id="memberLookupFreshResult"></div>',
'    </div>',
'  </dialog>'
  ].join('\n');
  html=html.replace('</body>',dialog+'\n</body>');
}

app += '\n'+("/* tmcsMemberSearchFreshV203 */\nfunction memberLookupFreshLabel(key){return String(key||'').replace(/_/g,' ').replace(/\\b\\w/g,c=>c.toUpperCase());}\nfunction memberLookupFreshValue(value){\n  if(value===null||value===undefined||value==='') return '—';\n  if(typeof value==='boolean') return value?'YES':'NO';\n  if(typeof value==='number') return Number(value).toLocaleString('en-NG');\n  const text=String(value);\n  if(/^\\d{4}-\\d{2}-\\d{2}T/.test(text)){const d=new Date(text);if(!Number.isNaN(d.getTime())) return d.toLocaleString('en-NG');}\n  return text;\n}\nfunction memberLookupFreshGrid(obj){\n  const entries=Object.entries(obj||{}).filter(([key])=>{\n    const k=String(key||'').toLowerCase();\n    return !k.includes('password')&&!k.includes('pin')&&!k.includes('hash')&&!k.includes('token')&&!k.includes('secret')&&!k.includes('credential');\n  });\n  if(!entries.length) return '<p class=\"empty-state\">No details available.</p>';\n  return '<div class=\"mini-grid\">'+entries.map(([key,value])=>'<div><span>'+escapeHTML(memberLookupFreshLabel(key))+'</span><b>'+escapeHTML(memberLookupFreshValue(value))+'</b></div>').join('')+'</div>';\n}\nfunction openMemberLookupFresh(){\n  const d=document.getElementById('memberLookupFreshDialog');\n  const i=document.getElementById('memberLookupFreshUsername');\n  const e=document.getElementById('memberLookupFreshError');\n  const r=document.getElementById('memberLookupFreshResult');\n  if(i) i.value=''; if(e) e.textContent=''; if(r) r.innerHTML='';\n  openDialog(d); setTimeout(()=>i?.focus(),50);\n}\nasync function runMemberLookupFresh(){\n  const i=document.getElementById('memberLookupFreshUsername');\n  const b=document.getElementById('memberLookupFreshSearch');\n  const e=document.getElementById('memberLookupFreshError');\n  const r=document.getElementById('memberLookupFreshResult');\n  const username=String(i?.value||'').trim().toUpperCase();\n  if(i) i.value=username; if(e) e.textContent=''; if(r) r.innerHTML='';\n  if(!(/^F[0-9]{3}$/.test(username)||/^[0-9]{1,5}$/.test(username))){if(e)e.textContent='Enter a valid Regular username or Flexible username (F + 3 digits).';return;}\n  const old=b?.textContent||'SEARCH';\n  try{\n    if(b){b.disabled=true;b.textContent='SEARCHING...';}\n    const data=await api('/api/admin/members/search?username='+encodeURIComponent(username),{cache:'no-store'});\n    const a=data?.account||{}; const bal=data?.balances||{};\n    if(!a.username) throw new Error('Member account not found.');\n    const name=a.name||a.full_name||'—'; const role=String(a.role||'').toUpperCase(); const status=a.is_active===false?'INACTIVE':'ACTIVE';\n    if(r) r.innerHTML='<div class=\"member-confirm show\" style=\"display:block;margin:8px 0 14px\"><b>'+escapeHTML(name)+' - '+escapeHTML(a.username)+'</b><br><small>'+escapeHTML(role)+' • '+escapeHTML(status)+'</small></div><h4 style=\"margin:10px 0 8px\">ACCOUNT DETAILS</h4>'+memberLookupFreshGrid(a)+'<h4 style=\"margin:16px 0 8px\">ACCOUNT BALANCES</h4>'+memberLookupFreshGrid(bal);\n  }catch(err){if(e)e.textContent=err.message||'Unable to search member.';}\n  finally{if(b){b.disabled=false;b.textContent=old;}}\n}\ndocument.addEventListener('click',(event)=>{\n  const card=event.target?.closest?.('.dashboard-card');\n  if(!card) return;\n  const title=String(card.querySelector('h4')?.textContent||'').trim().toUpperCase();\n  if(title!=='MEMBER SEARCH') return;\n  event.preventDefault(); event.stopImmediatePropagation(); openMemberLookupFresh();\n},true);\ndocument.getElementById('memberLookupFreshSearch')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();runMemberLookupFresh();});\ndocument.getElementById('memberLookupFreshUsername')?.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();runMemberLookupFresh();}});\ndocument.getElementById('memberLookupFreshUsername')?.addEventListener('input',(event)=>{let value=String(event.target.value||'').toUpperCase();if(value.startsWith('F'))value='F'+value.slice(1).replace(/\\D/g,'').slice(0,3);else value=value.replace(/\\D/g,'').slice(0,5);event.target.value=value;});")+'\n';
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=204'");
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=204');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=204');
fs.writeFileSync('www/app.js',app);
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v204';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO MEMBER SEARCH rebuilt from scratch, cache v204.');
