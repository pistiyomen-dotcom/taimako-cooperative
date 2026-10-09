const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

/* Stage 200 v202: intercept MEMBER SEARCH click before dialog/form can close. */
if(!app.includes('tmcsMemberSearchClickV202')){
  app += "\n/* tmcsMemberSearchClickV202 */\n"+
  "async function runMemberSearchV202(){\n"+
  "  const input=document.getElementById('searchUsername');\n"+
  "  const error=document.getElementById('memberSearchError');\n"+
  "  const result=document.getElementById('memberSearchResult');\n"+
  "  if(error) error.textContent='';\n"+
  "  if(result) result.innerHTML='';\n"+
  "  try{\n"+
  "    const username=String(input?.value||'').trim().toUpperCase();\n"+
  "    if(input) input.value=username;\n"+
  "    if(!(/^F[0-9]{3}$/.test(username)||/^[0-9]{1,5}$/.test(username))) throw new Error('Enter a valid Regular username or Flexible username (F + 3 digits).');\n"+
  "    const data=await api('/api/admin/members/search?username='+encodeURIComponent(username),{cache:'no-store'});\n"+
  "    if(!data?.account) throw new Error('Member account not found.');\n"+
  "    if(result){\n"+
  "      result.innerHTML=typeof memberSummary==='function' ? memberSummary(data) : '<div class=\\\"member-confirm show\\\"><b>'+escapeHTML(data.account.name||data.account.full_name||'')+' - '+escapeHTML(data.account.username||username)+'</b><br><small>'+escapeHTML(String(data.account.role||'').toUpperCase())+'</small></div>';\n"+
  "    }\n"+
  "    const dialog=document.getElementById('memberSearchDialog');\n"+
  "    if(dialog && !dialog.open && typeof dialog.showModal==='function') dialog.showModal();\n"+
  "  }catch(e){ if(error) error.textContent=e.message||'Unable to search member.'; }\n"+
  "}\n"+
  "document.addEventListener('click',async(event)=>{\n"+
  "  const button=event.target?.closest?.('button');\n"+
  "  if(!button) return;\n"+
  "  const form=button.closest?.('form');\n"+
  "  const label=String(button.textContent||'').trim().toUpperCase();\n"+
  "  const isMemberSearch=(form && form.id==='memberSearchForm' && label==='SEARCH') || (label==='SEARCH' && !!document.getElementById('searchUsername') && form?.contains(document.getElementById('searchUsername')));\n"+
  "  if(!isMemberSearch) return;\n"+
  "  event.preventDefault();\n"+
  "  event.stopImmediatePropagation();\n"+
  "  await runMemberSearchV202();\n"+
  "},true);\n"+
  "document.addEventListener('submit',(event)=>{\n"+
  "  if(event.target?.id!=='memberSearchForm') return;\n"+
  "  event.preventDefault();\n"+
  "  event.stopImmediatePropagation();\n"+
  "  runMemberSearchV202();\n"+
  "},true);\n"+
  "document.addEventListener('input',(event)=>{\n"+
  "  if(event.target?.id!=='searchUsername') return;\n"+
  "  let value=String(event.target.value||'').toUpperCase();\n"+
  "  if(value.startsWith('F')) value='F'+value.slice(1).replace(/\\D/g,'').slice(0,3);\n"+
  "  else value=value.replace(/\\D/g,'').slice(0,5);\n"+
  "  event.target.value=value;\n"+
  "},true);\n";
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=202'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=202');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=202');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v202';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 200 MEMBER SEARCH click interception applied, cache v202.');
