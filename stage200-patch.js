const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

/* Stage 200: repair the existing MEMBER SEARCH form without page reload. */
if(!app.includes('tmcsMemberSearchSubmitV200')){
  app += "\n/* tmcsMemberSearchSubmitV200 */\n"+
  "document.addEventListener('submit', async (event)=>{\n"+
  "  const form=event.target?.closest?.('#memberSearchForm');\n"+
  "  if(!form) return;\n"+
  "  event.preventDefault();\n"+
  "  event.stopImmediatePropagation();\n"+
  "  const error=document.getElementById('memberSearchError');\n"+
  "  const result=document.getElementById('memberSearchResult');\n"+
  "  const input=document.getElementById('searchUsername');\n"+
  "  if(error) error.textContent='';\n"+
  "  if(result) result.innerHTML='';\n"+
  "  try{\n"+
  "    const username=String(input?.value||'').trim().toUpperCase();\n"+
  "    if(input) input.value=username;\n"+
  "    if(!(/^F[0-9]{3}$/.test(username)||/^[0-9]{1,5}$/.test(username))) throw new Error('Enter a valid Regular username or Flexible username (F + 3 digits).');\n"+
  "    const data=await api('/api/admin/members/search?username='+encodeURIComponent(username),{cache:'no-store'});\n"+
  "    if(!data?.account) throw new Error('Member account not found.');\n"+
  "    if(result){\n"+
  "      if(typeof memberSummary==='function') result.innerHTML=memberSummary(data);\n"+
  "      else result.innerHTML='<div class=\\\"member-confirm show\\\"><b>'+escapeHTML(data.account.name||data.account.full_name||'')+' - '+escapeHTML(data.account.username||username)+'</b><br><small>'+escapeHTML(String(data.account.role||'').toUpperCase())+'</small></div>';\n"+
  "    }\n"+
  "  }catch(e){ if(error) error.textContent=e.message||'Unable to search member.'; }\n"+
  "},true);\n"+
  "document.addEventListener('input',(event)=>{\n"+
  "  if(event.target?.id!=='searchUsername') return;\n"+
  "  let value=String(event.target.value||'').toUpperCase();\n"+
  "  if(value.startsWith('F')) value='F'+value.slice(1).replace(/\\D/g,'').slice(0,3);\n"+
  "  else value=value.replace(/\\D/g,'').slice(0,5);\n"+
  "  event.target.value=value;\n"+
  "},true);\n";
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=201'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=201');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=201');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v201';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 200 MEMBER SEARCH form repaired, cache v201.');
