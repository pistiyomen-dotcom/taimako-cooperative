const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  /<button type="button" id="bankTransferCopyV129"[^>]*>.*?<\/button>/,
  '<button type="button" id="bankTransferCopyV129" aria-label="Copy account number" title="Copy account number" style="width:auto;min-width:0;padding:2px 4px;margin:0;background:transparent;color:#000;border:0;border-radius:4px;box-shadow:none;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/></svg></button>'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=132');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=132');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=132');
fs.writeFileSync('www/index.html',html);

let js=fs.readFileSync('www/bank-transfer-v129.js','utf8');
js=js.replace(
  "if(ok){const old=copy.textContent;copy.textContent='✓';setTimeout(()=>copy.textContent=old,1200);}",
  "if(ok){const old=copy.innerHTML;copy.textContent='✓';setTimeout(()=>copy.innerHTML=old,1200);}"
);
fs.writeFileSync('www/bank-transfer-v129.js',js);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v132';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 132 outlined document copy icon applied.');
