const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');

html=html.replace(
  /<button type="button" id="bankTransferCopyV129"[^>]*>COPY<\/button>/,
  '<button type="button" id="bankTransferCopyV129" aria-label="Copy account number" title="Copy account number" style="width:auto;min-width:0;padding:4px 6px;margin:0;background:transparent;color:#000;border:0;border-radius:6px;font-size:1.15rem;line-height:1;font-weight:900;box-shadow:none;vertical-align:middle">⧉</button>'
);

html=html.replace(/app\.js\?v=\d+/g,'app.js?v=131');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=131');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=131');
fs.writeFileSync('www/index.html',html);

let js=fs.readFileSync('www/bank-transfer-v129.js','utf8');
js=js.replace(
  "if(ok){copy.textContent='COPIED';setTimeout(()=>copy.textContent='COPY',1200);}",
  "if(ok){const old=copy.textContent;copy.textContent='✓';setTimeout(()=>copy.textContent=old,1200);}"
);
fs.writeFileSync('www/bank-transfer-v129.js',js);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v131';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 131 black copy icon applied.');
