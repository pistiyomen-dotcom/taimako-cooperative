const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes('function openMemberSearchRepairV200')){
  app += "\nfunction openMemberSearchRepairV200(){\n"+
  "  const value=prompt('Enter Regular username or Flexible username (F + 3 digits)');\n"+
  "  if(value===null) return;\n"+
  "  const username=String(value||'').trim().toUpperCase();\n"+
  "  if(!(/^F[0-9]{3}$/.test(username)||/^[0-9]{1,5}$/.test(username))){ alert('Enter a valid Regular or Flexible username.'); return; }\n"+
  "  api('/api/admin/members/search?username='+encodeURIComponent(username),{cache:'no-store'}).then(data=>{\n"+
  "    const member=data.account||data.member||data;\n"+
  "    if(!member||!member.username) throw new Error('Member account not found.');\n"+
  "    const lines=Object.entries(member).map(([k,v])=>k.replace(/_/g,' ').toUpperCase()+': '+(v??'—'));\n"+
  "    alert(lines.join('\\n'));\n"+
  "  }).catch(e=>alert(e.message||'Unable to search member.'));\n"+
  "}\n"+
  "document.addEventListener('click',(event)=>{\n"+
  "  const btn=event.target?.closest?.('button');\n"+
  "  if(btn && String(btn.textContent||'').trim().toUpperCase()==='MEMBER SEARCH'){\n"+
  "    event.preventDefault(); event.stopImmediatePropagation(); openMemberSearchRepairV200();\n"+
  "  }\n"+
  "},true);\n";
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=200'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=200');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v200';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 200 Member Search repaired.');
