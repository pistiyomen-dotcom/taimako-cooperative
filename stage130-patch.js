const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  'id="bankTransferCopyV129" class="secondary" style="width:auto;padding:5px 9px;min-width:54px"',
  'id="bankTransferCopyV129" class="secondary" style="width:auto;padding:6px 10px;min-width:58px;background:#0b6b3a;color:#fff;border:1px solid #07552e;border-radius:8px;font-weight:800;box-shadow:0 1px 2px rgba(0,0,0,.15)"'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=130');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=130');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=130');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v130';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 130 visible COPY button styling applied.');
